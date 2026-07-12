import { Injectable } from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { InjectMetric } from '@willsoto/nestjs-prometheus';

@Injectable()
export class MonitoringService {
  constructor(
    @InjectMetric('http_request_duration_seconds')
    private readonly httpRequestDuration: Histogram,
    @InjectMetric('ai_token_usage_total')
    private readonly aiTokenUsage: Counter,
  ) {}

  recordHttpRequestDuration(method: string, route: string, durationMs: number) {
    this.httpRequestDuration.observe({ method, route }, durationMs / 1000);
  }

  recordAITokenUsage(provider: string, model: string, tokens: number) {
    this.aiTokenUsage.inc({ provider, model }, tokens);
  }
}
