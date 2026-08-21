import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Counter, register } from 'prom-client';
import { PrismaService } from '../prisma.service';
import {
  AUDIT_PERSISTENCE_ERROR_CODE,
  type AuditEventPayload,
  type AuditWriter,
} from './audit.types';

@Injectable()
export class PrismaAuditWriter implements AuditWriter {
  private readonly logger = new Logger(PrismaAuditWriter.name);
  private readonly failures = metric(
    'lg_audit_persistence_failures_total',
    () =>
      new Counter({
        name: 'lg_audit_persistence_failures_total',
        help: 'Audit persistence failures grouped by action, severity and policy.',
        labelNames: ['action', 'severity', 'failure_mode'] as const,
      }),
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async recordEvent(payload: AuditEventPayload): Promise<void> {
    const requestId = payload.requestId ?? this.cls.get<string | undefined>('reqId');
    const traceId = payload.traceId ?? this.cls.get<string | undefined>('traceId');
    const failureMode = payload.failureMode ?? 'BEST_EFFORT';
    const severity = payload.severity ?? 'INFO';
    try {
      await this.prisma.auditEvent.create({
        data: {
          action: payload.action,
          actorId: payload.actorId,
          organizationId: payload.organizationId,
          resourceId: payload.resourceId,
          requestId,
          traceId,
          before: json(payload.before),
          after: json(payload.after),
          metadata: json(payload.metadata),
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
        },
      });
    } catch (error) {
      this.failures.labels(payload.action, severity, failureMode).inc();
      this.logger.error(
        `${AUDIT_PERSISTENCE_ERROR_CODE}: action=${payload.action} severity=${severity} policy=${failureMode}`,
        error,
      );
      if (failureMode === 'REQUIRED') {
        throw new ServiceUnavailableException({
          code: AUDIT_PERSISTENCE_ERROR_CODE,
          message:
            'A required security audit record failed; reconcile the requested change before retrying.',
        });
      }
    }
  }
}

function metric<T>(name: string, factory: () => T): T {
  return (register.getSingleMetric(name) as T | undefined) ?? factory();
}

function json(value: unknown): object | undefined {
  return value === undefined ? undefined : (value as object);
}
