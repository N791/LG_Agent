import { Injectable, Logger } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { LoggingProvider } from '../interfaces/logging-provider.interface';

@Injectable()
export class NativeLoggingProvider implements LoggingProvider {
  private readonly nestLogger = new Logger();

  constructor(private readonly cls: ClsService) {}

  private formatMessage(message: string, context?: string): string {
    const traceId = this.cls.get('traceId');
    const correlationId = this.cls.get('correlationId');
    const ctxPrefix = context ? `[${context}] ` : '';
    const tracePrefix = traceId ? `[TraceID: ${traceId}] ` : '';
    const corrPrefix = correlationId ? `[CorrID: ${correlationId}] ` : '';
    return `${ctxPrefix}${tracePrefix}${corrPrefix}${message}`;
  }

  log(message: string, context?: string): void {
    this.nestLogger.log(this.formatMessage(message, context));
  }

  error(message: string, trace?: string, context?: string): void {
    this.nestLogger.error(this.formatMessage(message, context), trace);
  }

  warn(message: string, context?: string): void {
    this.nestLogger.warn(this.formatMessage(message, context));
  }

  debug(message: string, context?: string): void {
    this.nestLogger.debug(this.formatMessage(message, context));
  }
}
