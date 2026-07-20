import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { TracingProvider } from '../interfaces/tracing-provider.interface';

@Injectable()
export class NativeTracingProvider implements TracingProvider {
  constructor(private readonly cls: ClsService) {}

  async runInSpan<T>(_name: string, fn: () => Promise<T> | T): Promise<T> {
    // For MVP, we just use the existing CLS context.
    // In a real tracing provider (like OpenTelemetry), this would create a new child span.
    return fn();
  }

  getTraceId(): string | undefined {
    return this.cls.get('traceId');
  }

  getCorrelationId(): string | undefined {
    return this.cls.get('correlationId');
  }
}
