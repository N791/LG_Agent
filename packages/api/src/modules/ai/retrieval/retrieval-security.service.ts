import { Injectable } from '@nestjs/common';
import {
  RetrievalErrorCodeDTO,
  type EvidenceDTO,
  type RetrievalAclStageDTO,
  type RetrievalScopeDTO,
} from '@lg-agent/contracts';
import { RetrievalPortError } from './retrieval.error';

export interface RetrievalLimits {
  searchTimeoutMs: number;
  rerankTimeoutMs: number;
  expansionTimeoutMs: number;
  assemblyTimeoutMs: number;
  maxCandidates: number;
  maxExpansionDepth: number;
  maxExpansionNodes: number;
  maxEvidenceTokens: number;
}

const DEFAULT_LIMITS: RetrievalLimits = {
  searchTimeoutMs: 3_000,
  rerankTimeoutMs: 1_500,
  expansionTimeoutMs: 2_000,
  assemblyTimeoutMs: 1_000,
  maxCandidates: 100,
  maxExpansionDepth: 3,
  maxExpansionNodes: 50,
  maxEvidenceTokens: 4_096,
};

/**
 * The common security boundary for every retrieval adapter.
 * Storage queries remain deny-by-default; these checks defend adapter, reranker,
 * cache and expansion boundaries from returning foreign-tenant material.
 */
@Injectable()
export class RetrievalSecurityService {
  readonly limits = DEFAULT_LIMITS;

  enforceEvidence(
    evidence: EvidenceDTO[],
    scope: RetrievalScopeDTO,
    _stage: RetrievalAclStageDTO,
  ): EvidenceDTO[] {
    return evidence
      .filter(
        (item) =>
          item.organizationId === scope.organizationId &&
          item.citation.organizationId === scope.organizationId,
      )
      .slice(0, this.limits.maxCandidates);
  }

  assertEvidence(
    evidence: EvidenceDTO,
    scope: RetrievalScopeDTO,
    stage: RetrievalAclStageDTO,
  ): void {
    if (this.enforceEvidence([evidence], scope, stage).length !== 1) {
      throw new RetrievalPortError(
        RetrievalErrorCodeDTO.ACCESS_DENIED,
        `Evidence is not authorized at ${stage.toLowerCase()} stage.`,
      );
    }
  }

  boundedDepth(value?: number): number {
    return Math.min(this.limits.maxExpansionDepth, Math.max(1, value ?? 1));
  }

  boundedNodes(value?: number): number {
    return Math.min(this.limits.maxExpansionNodes, Math.max(1, value ?? 20));
  }

  async withTimeout<T>(name: string, timeoutMs: number, operation: () => Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new RetrievalPortError(
                RetrievalErrorCodeDTO.TIMEOUT,
                `${name} exceeded its ${String(timeoutMs)}ms retrieval deadline.`,
              ),
            );
          }, timeoutMs);
          timer.unref();
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  assertDuration(name: string, startedAt: number, timeoutMs: number): void {
    if (Date.now() - startedAt > timeoutMs) {
      throw new RetrievalPortError(
        RetrievalErrorCodeDTO.TIMEOUT,
        `${name} exceeded its ${String(timeoutMs)}ms retrieval deadline.`,
      );
    }
  }

  /**
   * Evidence is data, never instruction. Delimiters and a policy label make that
   * boundary explicit to every prompt template without mutating the cited text.
   */
  asUntrustedPayload(content: string, evidenceId: string): string {
    const escaped = content.replaceAll('</untrusted-evidence>', '&lt;/untrusted-evidence&gt;');
    return `<untrusted-evidence id="${this.escapeAttribute(evidenceId)}" policy="data-only">\n${escaped}\n</untrusted-evidence>`;
  }

  private escapeAttribute(value: string): string {
    return value.replace(/[&"<>'`]/g, (character) => `&#${String(character.charCodeAt(0))};`);
  }
}
