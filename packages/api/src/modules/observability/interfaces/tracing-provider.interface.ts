export const TRACING_PROVIDER = 'TRACING_PROVIDER';

export interface TracingProvider {
  /**
   * Run a function within a new traced span.
   */
  runInSpan<T>(name: string, fn: () => Promise<T> | T): Promise<T>;
  
  /**
   * Retrieves the current Trace ID.
   */
  getTraceId(): string | undefined;

  /**
   * Retrieves the current Correlation ID.
   */
  getCorrelationId(): string | undefined;
}
