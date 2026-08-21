import { Injectable } from '@nestjs/common';
import {
  RetrievalRouteDTO,
  type EvidenceDTO,
  type TokenBudgetAllocationDTO,
} from '@lg-agent/contracts';

const MIN_TOTAL_BUDGET = 1_024;
const DEFAULT_TOTAL_BUDGET = 8_192;

export interface BudgetedEvidence {
  evidence: EvidenceDTO[];
  budget: TokenBudgetAllocationDTO;
}

@Injectable()
export class ContextBudgetService {
  allocate(total = DEFAULT_TOTAL_BUDGET): TokenBudgetAllocationDTO {
    const boundedTotal = Math.max(MIN_TOTAL_BUDGET, total);
    const systemPolicy = Math.ceil(boundedTotal * 0.14);
    const taskState = Math.ceil(boundedTotal * 0.08);
    const recentConversation = Math.ceil(boundedTotal * 0.12);
    const toolResults = Math.ceil(boundedTotal * 0.06);
    const modelOutput = Math.ceil(boundedTotal * 0.24);
    const dynamic = Math.max(
      0,
      boundedTotal - systemPolicy - taskState - recentConversation - toolResults - modelOutput,
    );

    return {
      total: boundedTotal,
      systemPolicy,
      taskState,
      recentConversation,
      documents: Math.floor(dynamic / 2),
      code: dynamic - Math.floor(dynamic / 2),
      toolResults,
      modelOutput,
      usedEvidence: 0,
      truncated: false,
    };
  }

  fit(
    evidence: EvidenceDTO[],
    allocation: TokenBudgetAllocationDTO,
    maxEvidenceTokens = Number.POSITIVE_INFINITY,
  ): BudgetedEvidence {
    const deduplicated = this.deduplicate(evidence);
    const remaining = {
      [RetrievalRouteDTO.DOCUMENT]: allocation.documents,
      [RetrievalRouteDTO.CODE]: allocation.code,
      [RetrievalRouteDTO.TASK_STATE]: allocation.taskState,
      [RetrievalRouteDTO.CONVERSATION]: allocation.recentConversation,
      [RetrievalRouteDTO.MIXED]: allocation.documents + allocation.code,
    };
    const ranked = [...deduplicated].sort((left, right) => {
      const leftValue = left.score / Math.max(1, this.estimateTokens(left.content));
      const rightValue = right.score / Math.max(1, this.estimateTokens(right.content));
      return rightValue - leftValue;
    });
    const accepted: EvidenceDTO[] = [];
    let usedEvidence = 0;

    for (const item of ranked) {
      const tokens =
        this.estimateTokens(item.content) + this.estimateTokens(JSON.stringify(item.citation));
      const route = item.route;
      if (tokens > remaining[route] || usedEvidence + tokens > maxEvidenceTokens) continue;
      remaining[route] -= tokens;
      usedEvidence += tokens;
      accepted.push(item);
    }

    return {
      evidence: accepted.sort((left, right) => right.score - left.score),
      budget: {
        ...allocation,
        usedEvidence,
        truncated: accepted.length < deduplicated.length,
      },
    };
  }

  estimateTokens(content: string): number {
    return Math.max(1, Math.ceil(content.length / 4));
  }

  private deduplicate(evidence: EvidenceDTO[]): EvidenceDTO[] {
    const byFact = new Map<string, EvidenceDTO>();
    for (const item of evidence) {
      const fingerprint = item.content.toLowerCase().replace(/\s+/g, ' ').trim();
      const existing = byFact.get(fingerprint);
      if (!existing) {
        byFact.set(fingerprint, item);
        continue;
      }
      const winner = item.score > existing.score ? item : existing;
      const other = winner === item ? existing : item;
      const additional = [
        ...((winner.metadata?.['additionalCitations'] as EvidenceDTO['citation'][] | undefined) ??
          []),
        other.citation,
      ];
      byFact.set(fingerprint, {
        ...winner,
        metadata: { ...winner.metadata, additionalCitations: additional },
      });
    }
    return [...byFact.values()];
  }
}
