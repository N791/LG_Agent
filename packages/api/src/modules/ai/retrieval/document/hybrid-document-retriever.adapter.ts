import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DisclosureLevelDTO,
  RetrievalErrorCodeDTO,
  RetrievalRouteDTO,
  type EvidenceDTO,
  type ExpandDocumentInputDTO,
  type SearchDocumentsInputDTO,
} from '@lg-agent/contracts';
import type { IDocumentRetriever } from '../interfaces';
import { RetrievalPortError } from '../retrieval.error';
import { RetrievalSecurityService } from '../retrieval-security.service';
import {
  DOCUMENT_EXPANSION_STORE,
  DOCUMENT_KEYWORD_SEARCH,
  DOCUMENT_RERANKER,
  DOCUMENT_VECTOR_SEARCH,
  RETRIEVAL_OBSERVER,
  type DocumentCandidate,
  type FusedDocumentCandidate,
  type IDocumentExpansionStore,
  type IDocumentReranker,
  type IDocumentSearchChannel,
  type IRetrievalObserver,
  type RetrievalStageObservation,
} from './hybrid-retrieval.interfaces';
import { ReciprocalRankFusionService } from './reciprocal-rank-fusion.service';

const POLICY_VERSION = 'document-hybrid-rrf-v1';

@Injectable()
export class HybridDocumentRetrieverAdapter implements IDocumentRetriever {
  constructor(
    @Inject(DOCUMENT_KEYWORD_SEARCH) private readonly keyword: IDocumentSearchChannel,
    @Inject(DOCUMENT_VECTOR_SEARCH) private readonly vector: IDocumentSearchChannel,
    @Inject(DOCUMENT_EXPANSION_STORE) private readonly expansion: IDocumentExpansionStore,
    @Inject(DOCUMENT_RERANKER) private readonly reranker: IDocumentReranker,
    private readonly fusion: ReciprocalRankFusionService,
    @Optional() @Inject(RETRIEVAL_OBSERVER) private readonly observer?: IRetrievalObserver,
    @Optional() private readonly security?: RetrievalSecurityService,
  ) {}

  async searchDocuments(input: SearchDocumentsInputDTO): Promise<EvidenceDTO[]> {
    if (!input.query.trim()) {
      throw new RetrievalPortError(
        RetrievalErrorCodeDTO.INVALID_QUERY,
        'Document search query must not be empty.',
      );
    }
    const topK = Math.min(50, Math.max(1, input.topK ?? 5));
    const request = { ...input, query: input.query.trim(), limit: Math.min(100, topK * 4) };
    const [keyword, vector] = await Promise.all([
      this.runStage('keyword', () => this.keyword.search(request)),
      this.runStage('vector', () => this.vector.search(request)),
    ]);
    if (!keyword.ok && !vector.ok) {
      throw new RetrievalPortError(
        RetrievalErrorCodeDTO.ADAPTER_UNAVAILABLE,
        'Both document retrieval channels are unavailable.',
      );
    }

    const fusionStart = Date.now();
    let candidates = this.fusion.fuse({
      ...(keyword.ok && { keyword: this.enforceScope(keyword.value, input.organizationId) }),
      ...(vector.ok && { vector: this.enforceScope(vector.value, input.organizationId) }),
    });
    this.observe('fusion', 'ok', fusionStart, candidates.length);

    const bounded = candidates.slice(0, Math.min(50, topK * 3));
    const authorizedCandidateIds = new Set(
      bounded.map(({ documentVersionId, chunkId }) => `${documentVersionId}:${chunkId}`),
    );
    const rerank = await this.runStage('rerank', () =>
      this.withTimeout('rerank', this.security?.limits.rerankTimeoutMs ?? 1_500, () =>
        this.reranker.rerank(input.query, bounded),
      ),
    );
    // Re-authorize after an external or model-backed reranker. A compromised
    // reranker cannot inject a cross-organization candidate.
    candidates = this.enforceScope(rerank.ok ? rerank.value : bounded, input.organizationId)
      .filter(({ documentVersionId, chunkId }) =>
        authorizedCandidateIds.has(`${documentVersionId}:${chunkId}`),
      )
      .slice(0, topK);

    if ((input.disclosureLevel ?? DisclosureLevelDTO.L1) === DisclosureLevelDTO.L2) {
      candidates = await this.expandTopCandidates(input, candidates, topK);
    }
    return candidates.map((candidate) =>
      this.toEvidence(candidate, input.disclosureLevel ?? DisclosureLevelDTO.L1),
    );
  }

  async expandDocument(input: ExpandDocumentInputDTO): Promise<EvidenceDTO[]> {
    const parsed = /^document:([^:]+):([^:]+)$/.exec(input.evidenceId);
    if (!parsed) {
      throw new RetrievalPortError(
        RetrievalErrorCodeDTO.EVIDENCE_NOT_FOUND,
        'Evidence id is not a versioned document evidence id.',
      );
    }
    const documentVersionId = parsed[1];
    const chunkId = parsed[2];
    if (!documentVersionId || !chunkId) {
      throw new RetrievalPortError(
        RetrievalErrorCodeDTO.EVIDENCE_NOT_FOUND,
        'Evidence id is missing its pinned document location.',
      );
    }
    const startedAt = Date.now();
    const candidates = this.enforceScope(
      await this.withTimeout(
        'document expansion',
        this.security?.limits.expansionTimeoutMs ?? 2_000,
        () =>
          this.expansion.expand({
            organizationId: input.organizationId,
            userId: input.userId,
            taskId: input.taskId,
            conversationId: input.conversationId,
            documentVersionId,
            chunkId,
            tokenBudget: input.disclosureLevel === DisclosureLevelDTO.L2 ? 1200 : 500,
          }),
      ),
      input.organizationId,
    );
    this.observe('expansion', 'ok', startedAt, candidates.length);
    return this.mergeOverlaps(candidates).map((candidate) =>
      this.toEvidence(
        {
          ...candidate,
          fusedScore: candidate.rawScore,
          fusedRank: candidate.rawRank,
          channels: {},
        },
        input.disclosureLevel,
      ),
    );
  }

  private async expandTopCandidates(
    input: SearchDocumentsInputDTO,
    candidates: FusedDocumentCandidate[],
    limit: number,
  ): Promise<FusedDocumentCandidate[]> {
    const startedAt = Date.now();
    const expanded = await Promise.all(
      candidates.slice(0, Math.min(3, candidates.length)).map(async (candidate) => {
        try {
          return await this.expansion.expand({
            organizationId: input.organizationId,
            userId: input.userId,
            taskId: input.taskId,
            conversationId: input.conversationId,
            documentVersionId: candidate.documentVersionId,
            chunkId: candidate.chunkId,
            tokenBudget: 800,
          });
        } catch {
          return [];
        }
      }),
    );
    const safe = this.enforceScope(expanded.flat(), input.organizationId);
    this.observe('expansion', safe.length ? 'ok' : 'degraded', startedAt, safe.length);
    const seen = new Set(candidates.map(({ chunkId }) => chunkId));
    const additions = this.mergeOverlaps(safe)
      .filter(({ chunkId }) => !seen.has(chunkId))
      .map((candidate, index) => ({
        ...candidate,
        fusedScore: 0,
        fusedRank: candidates.length + index + 1,
        channels: {},
      }));
    return [...candidates, ...additions].slice(0, limit);
  }

  private enforceScope<T extends { organizationId: string }>(
    candidates: T[],
    organizationId: string,
  ): T[] {
    return candidates.filter((candidate) => candidate.organizationId === organizationId);
  }

  private async withTimeout<T>(
    name: string,
    timeoutMs: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    return this.security ? this.security.withTimeout(name, timeoutMs, operation) : operation();
  }

  private mergeOverlaps(candidates: DocumentCandidate[]): DocumentCandidate[] {
    const seen = new Set<string>();
    return candidates
      .sort(
        (left, right) =>
          left.documentVersionId.localeCompare(right.documentVersionId) ||
          left.locator.startLine - right.locator.startLine ||
          left.chunkId.localeCompare(right.chunkId),
      )
      .filter((candidate) => {
        const key = `${candidate.documentVersionId}:${candidate.chunkId}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  private toEvidence(
    candidate: FusedDocumentCandidate,
    disclosureLevel: DisclosureLevelDTO,
  ): EvidenceDTO {
    const evidenceId = `document:${candidate.documentVersionId}:${candidate.chunkId}`;
    const anchor = candidate.locator.anchor;
    const uri = `${candidate.sourceUri}#${encodeURIComponent(anchor)}`;
    return {
      id: evidenceId,
      organizationId: candidate.organizationId,
      route: RetrievalRouteDTO.DOCUMENT,
      disclosureLevel,
      content: candidate.content,
      score: candidate.rerankScore ?? candidate.fusedScore,
      citation: {
        id: `citation:${evidenceId}`,
        organizationId: candidate.organizationId,
        title: candidate.sourceTitle,
        uri,
        documentId: candidate.documentId,
        documentVersionId: candidate.documentVersionId,
        chunkId: candidate.chunkId,
        revision: candidate.version,
        locator: {
          path: candidate.sourceUri,
          heading: candidate.sectionPath.join(' > '),
          page: candidate.locator.page,
          anchor,
          startLine: candidate.locator.startLine,
          endLine: candidate.locator.endLine,
        },
      },
      metadata: {
        retrievalPolicyVersion: POLICY_VERSION,
        fusedRank: candidate.fusedRank,
        channels: candidate.channels,
        ...(candidate.rerankScore !== undefined && { rerankScore: candidate.rerankScore }),
      },
    };
  }

  private async runStage<T>(
    stage: RetrievalStageObservation['stage'],
    execute: () => Promise<T>,
  ): Promise<{ ok: true; value: T } | { ok: false }> {
    const startedAt = Date.now();
    try {
      const value = await execute();
      const count = Array.isArray(value) ? value.length : 0;
      this.observe(stage, 'ok', startedAt, count);
      return { ok: true, value };
    } catch (error: unknown) {
      this.observe(stage, 'degraded', startedAt, 0, (error as Error).message);
      return { ok: false };
    }
  }

  private observe(
    stage: RetrievalStageObservation['stage'],
    status: RetrievalStageObservation['status'],
    startedAt: number,
    candidateCount: number,
    reason?: string,
  ): void {
    this.observer?.observe({
      stage,
      status,
      durationMs: Date.now() - startedAt,
      candidateCount,
      ...(reason && { reason }),
    });
  }
}
