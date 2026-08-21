import { Injectable } from '@nestjs/common';
import { Counter, Gauge, Histogram, register } from 'prom-client';

@Injectable()
export class AuthorizationMetricsService {
  private readonly resolutionDuration = metric(
    'lg_authorization_resolution_duration_seconds',
    () =>
      new Histogram({
        name: 'lg_authorization_resolution_duration_seconds',
        help: 'Database-backed authorization resolution latency.',
        labelNames: ['result'] as const,
        buckets: [0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
      }),
  );
  private readonly resolutionQueries = metric(
    'lg_authorization_resolution_db_queries_total',
    () =>
      new Counter({
        name: 'lg_authorization_resolution_db_queries_total',
        help: 'Database queries issued by authorization resolution.',
        labelNames: ['operation'] as const,
      }),
  );
  private readonly legacyBridgeUses = metric(
    'lg_authorization_legacy_bridge_uses_total',
    () =>
      new Counter({
        name: 'lg_authorization_legacy_bridge_uses_total',
        help: 'Legacy users.role bridge uses, grouped by reason.',
        labelNames: ['reason'] as const,
      }),
  );
  private readonly legacyBridgeLastUse = metric(
    'lg_authorization_legacy_bridge_last_use_timestamp_seconds',
    () =>
      new Gauge({
        name: 'lg_authorization_legacy_bridge_last_use_timestamp_seconds',
        help: 'Unix timestamp of the most recent legacy users.role bridge use.',
      }),
  );

  observeResolution(durationSeconds: number, result: 'assigned' | 'unassigned'): void {
    this.resolutionDuration.labels(result).observe(durationSeconds);
  }

  recordResolutionQuery(operation: 'assignments' | 'legacy_user' | 'legacy_role'): void {
    this.resolutionQueries.labels(operation).inc();
  }

  recordLegacyBridgeUse(reason: 'create' | 'lazy_backfill' | 'role_change' | 'organization_move') {
    this.legacyBridgeUses.labels(reason).inc();
    this.legacyBridgeLastUse.set(Date.now() / 1000);
  }
}

function metric<T>(name: string, factory: () => T): T {
  return (register.getSingleMetric(name) as T | undefined) ?? factory();
}
