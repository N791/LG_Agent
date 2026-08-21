import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  DisclosureLevelDTO,
  RetrievalErrorCodeDTO,
  RetrievalRouteDTO,
  type EvidenceDTO,
  type ExpandSymbolInputDTO,
  type ReadSymbolInputDTO,
  type SearchSymbolsInputDTO,
} from '@lg-agent/contracts';
import type { ICodeRetriever } from '../interfaces';
import { RetrievalPortError } from '../retrieval.error';
import { RetrievalSecurityService } from '../retrieval-security.service';
import {
  CODE_RETRIEVAL_STORE,
  type CodeRelationRecord,
  type CodeSymbolRecord,
  type ICodeRetrievalStore,
} from './code-retrieval.store';

const POLICY_VERSION = 'repository-ast-symbol-v1';
const MAX_DEPTH = 3;
const MAX_NODES = 50;
const MAX_CONTENT_CHARS = 16_000;

type RequestedRelation = NonNullable<ExpandSymbolInputDTO['relationTypes']>[number];

@Injectable()
export class AstCodeRetrieverAdapter implements ICodeRetriever {
  constructor(
    @Inject(CODE_RETRIEVAL_STORE) private readonly store: ICodeRetrievalStore,
    @Optional() private readonly security?: RetrievalSecurityService,
  ) {}

  async searchSymbols(input: SearchSymbolsInputDTO): Promise<EvidenceDTO[]> {
    const query = input.query.trim();
    if (!query) {
      throw new RetrievalPortError(
        RetrievalErrorCodeDTO.INVALID_QUERY,
        'Code symbol search query must not be empty.',
      );
    }
    const level = input.disclosureLevel ?? DisclosureLevelDTO.L0;
    const symbols = await this.withTimeout('search_symbols', () =>
      this.store.search({
        organizationId: input.organizationId,
        userId: input.userId,
        query,
        ...(input.repositorySnapshotId && {
          repositorySnapshotId: input.repositorySnapshotId,
        }),
        limit: Math.min(this.security?.limits.maxCandidates ?? 50, Math.max(1, input.topK ?? 8)),
      }),
    );
    return symbols.map((symbol) => this.toEvidence(symbol, level));
  }

  async readSymbol(input: ReadSymbolInputDTO): Promise<EvidenceDTO[]> {
    const symbol = await this.withTimeout('read_symbol', () => this.store.read(input));
    if (!symbol) {
      throw new RetrievalPortError(
        RetrievalErrorCodeDTO.EVIDENCE_NOT_FOUND,
        'Symbol does not exist in the authorized immutable snapshot.',
      );
    }
    return [this.toEvidence(symbol, input.disclosureLevel ?? DisclosureLevelDTO.L1)];
  }

  async expandSymbol(input: ExpandSymbolInputDTO): Promise<EvidenceDTO[]> {
    const root = await this.withTimeout('expand_symbol root read', () => this.store.read(input));
    if (!root) {
      throw new RetrievalPortError(
        RetrievalErrorCodeDTO.EVIDENCE_NOT_FOUND,
        'Symbol does not exist in the authorized immutable snapshot.',
      );
    }
    const depth =
      this.security?.boundedDepth(input.depth) ??
      Math.min(MAX_DEPTH, Math.max(1, input.depth ?? 1));
    const limit =
      this.security?.boundedNodes(input.limit) ??
      Math.min(MAX_NODES, Math.max(1, input.limit ?? 20));
    const requested = new Set<RequestedRelation>(
      input.relationTypes ?? ['CALLS', 'CALLED_BY', 'IMPLEMENTS', 'TESTED_BY'],
    );
    const allRelations = await this.withTimeout('expand_symbol graph read', () =>
      this.store.relations(input),
    );
    const visited = new Set([root.id]);
    const discovered: {
      id: string;
      depth: number;
      relation: RequestedRelation;
      cycle: boolean;
      confidence: number;
      heuristic?: string;
    }[] = [];
    let frontier = [root.id];
    for (let currentDepth = 1; currentDepth <= depth && frontier.length; currentDepth += 1) {
      const next: string[] = [];
      for (const sourceId of frontier) {
        for (const edge of allRelations) {
          const traversal = this.traverse(edge, sourceId, requested);
          if (!traversal) continue;
          const cycle = visited.has(traversal.id);
          if (discovered.length < limit) {
            discovered.push({ ...traversal, depth: currentDepth, cycle });
          }
          if (!cycle && visited.size < limit + 1) {
            visited.add(traversal.id);
            next.push(traversal.id);
          }
        }
      }
      frontier = [...new Set(next)];
    }
    const records = await this.withTimeout('expand_symbol evidence read', () =>
      this.store.readMany({
        organizationId: input.organizationId,
        userId: input.userId,
        repositorySnapshotId: input.repositorySnapshotId,
        symbolIds: [...new Set(discovered.map(({ id }) => id))],
      }),
    );
    const byId = new Map(records.map((record) => [record.id, record]));
    let remaining = MAX_CONTENT_CHARS;
    return discovered
      .map((item) => ({ item, symbol: byId.get(item.id) }))
      .filter((entry): entry is { item: (typeof discovered)[number]; symbol: CodeSymbolRecord } =>
        Boolean(entry.symbol),
      )
      .map(({ item, symbol }) => {
        const evidence = this.toEvidence(symbol, DisclosureLevelDTO.L2);
        evidence.content = evidence.content.slice(0, Math.max(0, remaining));
        remaining -= evidence.content.length;
        evidence.metadata = {
          ...evidence.metadata,
          relationType: item.relation,
          relationDepth: item.depth,
          cycle: item.cycle,
          relationConfidence: item.confidence,
          ...(item.heuristic && { heuristic: item.heuristic }),
        };
        return evidence;
      })
      .filter(({ content }) => content.length > 0);
  }

  private withTimeout<T>(name: string, operation: () => Promise<T>): Promise<T> {
    return this.security
      ? this.security.withTimeout(name, this.security.limits.expansionTimeoutMs, operation)
      : operation();
  }

  private traverse(
    edge: CodeRelationRecord,
    currentId: string,
    requested: Set<RequestedRelation>,
  ):
    | {
        id: string;
        relation: RequestedRelation;
        confidence: number;
        heuristic?: string;
      }
    | undefined {
    const forward = edge.sourceSymbolId === currentId;
    const reverse = edge.targetSymbolId === currentId;
    const candidates: [RequestedRelation, boolean, string][] = [
      [edge.relationType as RequestedRelation, forward, edge.targetSymbolId],
      [
        edge.relationType === 'CALLS'
          ? 'CALLED_BY'
          : edge.relationType === 'TESTS'
            ? 'TESTED_BY'
            : edge.relationType,
        reverse,
        edge.sourceSymbolId,
      ],
    ];
    const match = candidates.find(([type, direction]) => direction && requested.has(type));
    if (!match) return undefined;
    return {
      id: match[2],
      relation: match[0],
      confidence: edge.confidence,
      ...(edge.heuristic && { heuristic: edge.heuristic }),
    };
  }

  private toEvidence(symbol: CodeSymbolRecord, disclosureLevel: DisclosureLevelDTO): EvidenceDTO {
    const id = `code:${symbol.repositorySnapshotId}:${symbol.id}`;
    const content =
      disclosureLevel === DisclosureLevelDTO.L0
        ? [symbol.qualifiedName, symbol.signature, symbol.summary].filter(Boolean).join('\n')
        : symbol.content;
    return {
      id,
      organizationId: symbol.organizationId,
      route: RetrievalRouteDTO.CODE,
      disclosureLevel,
      content,
      score: symbol.score,
      citation: {
        id: `citation:${id}`,
        organizationId: symbol.organizationId,
        title: `${symbol.repositoryName}: ${symbol.qualifiedName}`,
        uri: `${symbol.canonicalUri}/blob/${symbol.commitSha}/${symbol.path}#L${String(symbol.startLine)}-L${String(symbol.endLine)}`,
        repositorySnapshotId: symbol.repositorySnapshotId,
        repositoryId: symbol.repositoryId,
        symbolId: symbol.id,
        revision: symbol.commitSha,
        locator: {
          path: symbol.path,
          symbol: symbol.id,
          startLine: symbol.startLine,
          endLine: symbol.endLine,
        },
      },
      metadata: {
        repositoryId: symbol.repositoryId,
        symbolId: symbol.id,
        kind: symbol.kind,
        language: symbol.language,
        signature: symbol.signature,
        parseConfidence: symbol.parseConfidence,
        ...(symbol.fallbackReason && { fallbackReason: symbol.fallbackReason }),
        retrievalPolicyVersion: POLICY_VERSION,
      },
    };
  }
}
