import { Injectable, Logger } from '@nestjs/common';
import type { EvidenceDTO } from '@lg-agent/contracts';

export interface RetrievalShadowComparison {
  organizationId: string;
  queryHash: string;
  legacyCount: number;
  candidateCount: number;
  overlapAtK: number;
  topResultChanged: boolean;
  candidateFailed: boolean;
  durationMs: number;
}

@Injectable()
export class RetrievalShadowService {
  private readonly logger = new Logger(RetrievalShadowService.name);
  private readonly comparisons: RetrievalShadowComparison[] = [];

  compare(
    organizationId: string,
    queryHash: string,
    legacy: EvidenceDTO[],
    candidate: EvidenceDTO[],
    durationMs: number,
  ): void {
    const legacyIds = new Set(legacy.map(({ id }) => id));
    const overlap = candidate.filter(({ id }) => legacyIds.has(id)).length;
    const comparison: RetrievalShadowComparison = {
      organizationId,
      queryHash,
      legacyCount: legacy.length,
      candidateCount: candidate.length,
      overlapAtK: Math.max(legacy.length, candidate.length)
        ? overlap / Math.max(legacy.length, candidate.length)
        : 1,
      topResultChanged: legacy[0]?.id !== candidate[0]?.id,
      candidateFailed: false,
      durationMs,
    };
    this.push(comparison);
  }

  failed(organizationId: string, queryHash: string, durationMs: number): void {
    this.push({
      organizationId,
      queryHash,
      legacyCount: 0,
      candidateCount: 0,
      overlapAtK: 0,
      topResultChanged: false,
      candidateFailed: true,
      durationMs,
    });
  }

  list(organizationId: string): RetrievalShadowComparison[] {
    return this.comparisons
      .filter((item) => item.organizationId === organizationId)
      .map((item) => ({ ...item }));
  }

  private push(comparison: RetrievalShadowComparison): void {
    this.comparisons.push(comparison);
    if (this.comparisons.length > 500) this.comparisons.shift();
    this.logger.debug(JSON.stringify({ event: 'retrieval_shadow_comparison', ...comparison }));
  }
}
