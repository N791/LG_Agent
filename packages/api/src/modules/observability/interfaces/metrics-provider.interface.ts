export const METRICS_PROVIDER = 'METRICS_PROVIDER';

export interface MetricsProvider {
  /**
   * Increment a counter metric.
   */
  incrementCounter(name: string, value?: number, tags?: Record<string, string>): void;

  /**
   * Record a value in a histogram.
   */
  observeHistogram(name: string, value: number, tags?: Record<string, string>): void;

  /**
   * Set a gauge value.
   */
  setGauge(name: string, value: number, tags?: Record<string, string>): void;
}
