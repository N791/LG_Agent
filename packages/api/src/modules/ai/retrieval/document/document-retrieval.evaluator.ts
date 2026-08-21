import { Injectable } from '@nestjs/common';

export interface DocumentEvaluationCase {
  id: string;
  relevantChunkIds: string[];
  returnedChunkIds: string[];
  citedChunkIds: string[];
  latencyMs: number;
}

export interface DocumentEvaluationMetrics {
  recallAtK: number;
  mrr: number;
  ndcg: number;
  citationPrecision: number;
  p95LatencyMs: number;
  caseCount: number;
}

export interface DocumentEvaluationThresholds {
  recallAtK: number;
  mrr: number;
  ndcg: number;
  citationPrecision: number;
  p95LatencyMs: number;
}

@Injectable()
export class DocumentRetrievalEvaluator {
  evaluate(cases: DocumentEvaluationCase[]): DocumentEvaluationMetrics {
    if (cases.length === 0) {
      return {
        recallAtK: 0,
        mrr: 0,
        ndcg: 0,
        citationPrecision: 0,
        p95LatencyMs: 0,
        caseCount: 0,
      };
    }
    const mean = (values: number[]): number =>
      values.reduce((total, value) => total + value, 0) / values.length;
    const recalls: number[] = [];
    const reciprocalRanks: number[] = [];
    const ndcgs: number[] = [];
    let validCitations = 0;
    let citationCount = 0;

    for (const item of cases) {
      const relevant = new Set(item.relevantChunkIds);
      const hits = item.returnedChunkIds.filter((id) => relevant.has(id));
      recalls.push(relevant.size === 0 ? 1 : new Set(hits).size / relevant.size);
      const firstRelevant = item.returnedChunkIds.findIndex((id) => relevant.has(id));
      reciprocalRanks.push(firstRelevant < 0 ? 0 : 1 / (firstRelevant + 1));
      const dcg = item.returnedChunkIds.reduce(
        (score, id, index) => score + (relevant.has(id) ? 1 / Math.log2(index + 2) : 0),
        0,
      );
      const idealHits = Math.min(relevant.size, item.returnedChunkIds.length);
      const idealDcg = Array.from(
        { length: idealHits },
        (_, index) => 1 / Math.log2(index + 2),
      ).reduce((total, value) => total + value, 0);
      ndcgs.push(idealDcg === 0 ? 1 : dcg / idealDcg);
      citationCount += item.citedChunkIds.length;
      validCitations += item.citedChunkIds.filter((id) => relevant.has(id)).length;
    }
    const latencies = cases.map(({ latencyMs }) => latencyMs).sort((a, b) => a - b);
    const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);
    return {
      recallAtK: mean(recalls),
      mrr: mean(reciprocalRanks),
      ndcg: mean(ndcgs),
      citationPrecision: citationCount === 0 ? 1 : validCitations / citationCount,
      p95LatencyMs: latencies[p95Index] ?? 0,
      caseCount: cases.length,
    };
  }

  assertThresholds(
    metrics: DocumentEvaluationMetrics,
    thresholds: DocumentEvaluationThresholds,
  ): void {
    const failures = [
      metrics.recallAtK < thresholds.recallAtK && 'Recall@K',
      metrics.mrr < thresholds.mrr && 'MRR',
      metrics.ndcg < thresholds.ndcg && 'nDCG',
      metrics.citationPrecision < thresholds.citationPrecision && 'citation precision',
      metrics.p95LatencyMs > thresholds.p95LatencyMs && 'P95 latency',
    ].filter((value): value is string => typeof value === 'string');
    if (failures.length) {
      throw new Error(`Document retrieval evaluation gate failed: ${failures.join(', ')}`);
    }
  }
}
