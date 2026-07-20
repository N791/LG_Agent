import { Injectable } from '@nestjs/common';
import { MetricsProvider } from '../interfaces/metrics-provider.interface';
import { MonitoringService } from '../../platform/monitoring/monitoring.service';

@Injectable()
export class NativeMetricsProvider implements MetricsProvider {
  constructor(private readonly monitoringService: MonitoringService) {}

  incrementCounter(name: string, value = 1, tags?: Record<string, string>): void {
    if (name === 'ai_token_usage_total' && tags) {
      this.monitoringService.recordAITokenUsage(tags['provider'] ?? 'unknown', tags['model'] ?? 'unknown', value);
    }
    // Future metrics can be added here or MonitoringService can be expanded to be generic.
  }

  observeHistogram(name: string, value: number, tags?: Record<string, string>): void {
    if (name === 'http_request_duration_seconds' && tags) {
      this.monitoringService.recordHttpRequestDuration(tags['method'] ?? 'GET', tags['route'] ?? '/', value * 1000); // our service expects MS, histogram expects seconds? Wait, existing service expects ms and converts to seconds.
    }
  }

  setGauge(_name: string, _value: number, _tags?: Record<string, string>): void {
    // Stub for gauge, as MonitoringService doesn't have it yet.
  }
}
