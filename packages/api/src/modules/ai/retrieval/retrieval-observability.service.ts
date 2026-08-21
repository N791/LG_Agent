import { Injectable } from '@nestjs/common';
import type { RetrievalStageObservation } from './document/hybrid-retrieval.interfaces';

export type RetrievalComponent = 'document' | 'code' | 'reranker' | 'cache';

export interface RetrievalHealthSnapshot {
  component: RetrievalComponent;
  requests: number;
  degraded: number;
  failures: number;
  degradationRate: number;
  latencyMs: { p50: number; p95: number; p99: number };
  alert: boolean;
}

@Injectable()
export class RetrievalObservabilityService {
  private readonly samples = new Map<
    RetrievalComponent,
    { durationMs: number; status: 'ok' | 'degraded' | 'failed' }[]
  >();

  observe(
    component: RetrievalComponent,
    observation: Pick<RetrievalStageObservation, 'durationMs' | 'status'>,
  ): void {
    const samples = this.samples.get(component) ?? [];
    samples.push(observation);
    if (samples.length > 1_000) samples.shift();
    this.samples.set(component, samples);
  }

  snapshot(component: RetrievalComponent): RetrievalHealthSnapshot {
    const samples = this.samples.get(component) ?? [];
    const degraded = samples.filter(({ status }) => status === 'degraded').length;
    const failures = samples.filter(({ status }) => status === 'failed').length;
    const degradationRate = samples.length ? (degraded + failures) / samples.length : 0;
    const durations = samples.map(({ durationMs }) => durationMs).sort((a, b) => a - b);
    const percentile = (value: number): number =>
      durations[Math.max(0, Math.ceil(durations.length * value) - 1)] ?? 0;
    return {
      component,
      requests: samples.length,
      degraded,
      failures,
      degradationRate,
      latencyMs: { p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) },
      alert: samples.length >= 5 && (degradationRate >= 0.2 || failures >= 3),
    };
  }

  snapshots(): RetrievalHealthSnapshot[] {
    return (['document', 'code', 'reranker', 'cache'] as const).map((component) =>
      this.snapshot(component),
    );
  }
}
