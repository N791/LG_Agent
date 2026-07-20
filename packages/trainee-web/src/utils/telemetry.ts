interface TelemetryLog {
  level: 'ERROR' | 'WARN' | 'INFO';
  message: string;
  stack?: string;
  path?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

interface TelemetryMetric {
  name: string;
  value: number;
  rating?: 'good' | 'needs-improvement' | 'poor';
  path?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

class TelemetryClient {
  private logBuffer: TelemetryLog[] = [];
  private metricBuffer: TelemetryMetric[] = [];
  private flushInterval: number = 10000; // 10 seconds
  private endpoint = '/api/v1/telemetry';

  constructor() {
    if (typeof window !== 'undefined') {
      setInterval(() => this.flush(), this.flushInterval);
      window.addEventListener('beforeunload', () => this.flush(true));
    }
  }

  public logError(message: string, stack?: string, metadata?: Record<string, any>) {
    this.logBuffer.push({
      level: 'ERROR',
      message,
      stack,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  public recordMetric(name: string, value: number, rating?: 'good' | 'needs-improvement' | 'poor', metadata?: Record<string, any>) {
    this.metricBuffer.push({
      name,
      value,
      rating,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      metadata,
      timestamp: new Date().toISOString(),
    });
  }

  public async flush(useBeacon = false) {
    if (this.logBuffer.length === 0 && this.metricBuffer.length === 0) {
      return;
    }

    const payload = JSON.stringify({
      logs: this.logBuffer,
      metrics: this.metricBuffer,
    });

    // Clear buffers
    this.logBuffer = [];
    this.metricBuffer = [];

    if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      // sendBeacon requires Blob for application/json if using standard setup, 
      // but to keep it simple we can use standard fetch with keepalive.
      try {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      } catch (err) {
        console.error('Failed to send telemetry via fetch keepalive', err);
      }
    } else {
      try {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
        });
      } catch (err) {
        console.error('Failed to send telemetry', err);
      }
    }
  }
}

export const telemetry = new TelemetryClient();
