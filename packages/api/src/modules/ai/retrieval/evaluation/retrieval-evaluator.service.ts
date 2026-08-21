import { Injectable } from '@nestjs/common';
import { RetrievalRouteDTO } from '@lg-agent/contracts';

export type GoldenCaseKind =
  'DOCUMENT_QA' | 'CODE_NAVIGATION' | 'CALL_CHAIN' | 'TEST_LOCATION' | 'MIXED';

export interface RetrievalGoldenCase {
  id: string;
  datasetVersion: string;
  kind: GoldenCaseKind;
  expectedRoute: RetrievalRouteDTO;
  actualRoute: RetrievalRouteDTO;
  relevantEvidenceIds: string[];
  baselineEvidenceIds?: string[];
  returnedEvidenceIds: string[];
  citedEvidenceIds: string[];
  groundedClaims: number;
  totalClaims: number;
  inputTokens: number;
  effectiveEvidenceCount: number;
  cacheHit: boolean;
  indexItemsProcessed?: number;
  indexDurationMs?: number;
  retrievalLatencyMs: number;
  endToEndLatencyMs: number;
}

export interface RetrievalEvaluationReport {
  datasetVersion: string;
  caseCount: number;
  recallAtK: number;
  mrr: number;
  ndcg: number;
  rerankLift: number;
  citationPrecision: number;
  groundedness: number;
  routeAccuracy: number;
  tokensPerEffectiveEvidence: number;
  cacheHitRate: number;
  indexThroughputPerSecond: number;
  retrievalLatencyMs: { p50: number; p95: number; p99: number };
  endToEndLatencyMs: { p50: number; p95: number; p99: number };
}

export type RetrievalGateThresholds = Partial<
  Omit<
    RetrievalEvaluationReport,
    'datasetVersion' | 'caseCount' | 'retrievalLatencyMs' | 'endToEndLatencyMs'
  >
> & {
  maxTokensPerEffectiveEvidence?: number;
  maxRetrievalP95Ms?: number;
  maxEndToEndP95Ms?: number;
};

@Injectable()
export class RetrievalEvaluatorService {
  evaluate(cases: RetrievalGoldenCase[]): RetrievalEvaluationReport {
    const datasetVersions = new Set(cases.map(({ datasetVersion }) => datasetVersion));
    if (datasetVersions.size !== 1) {
      throw new Error('A retrieval evaluation run must use exactly one dataset version.');
    }
    const mean = (values: number[]): number =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const quality = cases.map((item) => this.quality(item));
    const totalCitations = cases.reduce((sum, item) => sum + item.citedEvidenceIds.length, 0);
    const validCitations = cases.reduce((sum, item) => {
      const relevant = new Set(item.relevantEvidenceIds);
      return sum + item.citedEvidenceIds.filter((id) => relevant.has(id)).length;
    }, 0);
    const indexItems = cases.reduce((sum, item) => sum + (item.indexItemsProcessed ?? 0), 0);
    const indexDuration = cases.reduce((sum, item) => sum + (item.indexDurationMs ?? 0), 0);
    return {
      datasetVersion: [...datasetVersions][0] ?? 'empty',
      caseCount: cases.length,
      recallAtK: mean(quality.map(({ recall }) => recall)),
      mrr: mean(quality.map(({ reciprocalRank }) => reciprocalRank)),
      ndcg: mean(quality.map(({ ndcg }) => ndcg)),
      rerankLift: mean(quality.map(({ rerankLift }) => rerankLift)),
      citationPrecision: totalCitations ? validCitations / totalCitations : 1,
      groundedness:
        cases.reduce((sum, item) => sum + item.totalClaims, 0) === 0
          ? 1
          : cases.reduce((sum, item) => sum + item.groundedClaims, 0) /
            cases.reduce((sum, item) => sum + item.totalClaims, 0),
      routeAccuracy: mean(cases.map((item) => Number(item.actualRoute === item.expectedRoute))),
      tokensPerEffectiveEvidence:
        cases.reduce((sum, item) => sum + item.effectiveEvidenceCount, 0) === 0
          ? 0
          : cases.reduce((sum, item) => sum + item.inputTokens, 0) /
            cases.reduce((sum, item) => sum + item.effectiveEvidenceCount, 0),
      cacheHitRate: mean(cases.map(({ cacheHit }) => Number(cacheHit))),
      indexThroughputPerSecond: indexDuration ? indexItems / (indexDuration / 1_000) : 0,
      retrievalLatencyMs: this.percentiles(
        cases.map(({ retrievalLatencyMs }) => retrievalLatencyMs),
      ),
      endToEndLatencyMs: this.percentiles(cases.map(({ endToEndLatencyMs }) => endToEndLatencyMs)),
    };
  }

  assertRegressionGate(
    report: RetrievalEvaluationReport,
    thresholds: RetrievalGateThresholds,
  ): void {
    const lowerBound: (keyof Pick<
      RetrievalEvaluationReport,
      | 'recallAtK'
      | 'mrr'
      | 'ndcg'
      | 'rerankLift'
      | 'citationPrecision'
      | 'groundedness'
      | 'routeAccuracy'
      | 'cacheHitRate'
      | 'indexThroughputPerSecond'
    >)[] = [
      'recallAtK',
      'mrr',
      'ndcg',
      'rerankLift',
      'citationPrecision',
      'groundedness',
      'routeAccuracy',
      'cacheHitRate',
      'indexThroughputPerSecond',
    ];
    const failures = lowerBound
      .filter((key) => {
        const threshold = thresholds[key];
        return threshold !== undefined && report[key] < threshold;
      })
      .map(String);
    if (
      thresholds.maxTokensPerEffectiveEvidence !== undefined &&
      report.tokensPerEffectiveEvidence > thresholds.maxTokensPerEffectiveEvidence
    )
      failures.push('tokensPerEffectiveEvidence');
    if (
      thresholds.maxRetrievalP95Ms !== undefined &&
      report.retrievalLatencyMs.p95 > thresholds.maxRetrievalP95Ms
    )
      failures.push('retrievalLatency.p95');
    if (
      thresholds.maxEndToEndP95Ms !== undefined &&
      report.endToEndLatencyMs.p95 > thresholds.maxEndToEndP95Ms
    )
      failures.push('endToEndLatency.p95');
    if (failures.length)
      throw new Error(`Retrieval regression gate failed: ${failures.join(', ')}`);
  }

  private quality(item: RetrievalGoldenCase): {
    recall: number;
    reciprocalRank: number;
    ndcg: number;
    rerankLift: number;
  } {
    const relevant = new Set(item.relevantEvidenceIds);
    const hits = item.returnedEvidenceIds.filter((id) => relevant.has(id));
    const first = item.returnedEvidenceIds.findIndex((id) => relevant.has(id));
    const dcg = item.returnedEvidenceIds.reduce(
      (sum, id, index) => sum + (relevant.has(id) ? 1 / Math.log2(index + 2) : 0),
      0,
    );
    const ideal = Array.from(
      { length: Math.min(relevant.size, item.returnedEvidenceIds.length) },
      (_, index) => 1 / Math.log2(index + 2),
    ).reduce((sum, value) => sum + value, 0);
    const baselineFirst = item.baselineEvidenceIds?.findIndex((id) => relevant.has(id)) ?? -1;
    return {
      recall: relevant.size ? new Set(hits).size / relevant.size : 1,
      reciprocalRank: first < 0 ? 0 : 1 / (first + 1),
      ndcg: ideal ? dcg / ideal : 1,
      rerankLift:
        baselineFirst < 0
          ? first < 0
            ? 0
            : 1
          : 1 / (first + 1 || Number.POSITIVE_INFINITY) - 1 / (baselineFirst + 1),
    };
  }

  private percentiles(values: number[]): { p50: number; p95: number; p99: number } {
    const sorted = [...values].sort((left, right) => left - right);
    const at = (percentile: number): number =>
      sorted[Math.max(0, Math.ceil(sorted.length * percentile) - 1)] ?? 0;
    return { p50: at(0.5), p95: at(0.95), p99: at(0.99) };
  }
}
