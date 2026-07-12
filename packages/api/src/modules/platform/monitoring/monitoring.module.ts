import { Module } from '@nestjs/common';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { MonitoringService } from './monitoring.service';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
  ],
  providers: [
    MonitoringService,
    makeHistogramProvider({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.1, 0.3, 0.5, 1, 1.5, 2, 5, 10],
    }),
    makeCounterProvider({
      name: 'ai_token_usage_total',
      help: 'Total number of AI tokens used',
      labelNames: ['provider', 'model'],
    }),
  ],
  exports: [MonitoringService],
})
export class MonitoringModule {}
