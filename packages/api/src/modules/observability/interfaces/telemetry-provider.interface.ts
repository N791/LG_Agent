export interface TelemetryLog {
  userId?: string;
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface TelemetryMetric {
  userId?: string;
  name: string; // LCP, FID, CLS, TTFB, API_LATENCY, WORKSPACE_LOAD
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  path?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export const TELEMETRY_PROVIDER = 'TELEMETRY_PROVIDER';

export interface TelemetryProvider {
  recordLog(log: TelemetryLog): Promise<void>;
  recordMetric(metric: TelemetryMetric): Promise<void>;
  recordBatch(logs: TelemetryLog[], metrics: TelemetryMetric[]): Promise<void>;
}
