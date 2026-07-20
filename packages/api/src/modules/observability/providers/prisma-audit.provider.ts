import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { ClsService } from 'nestjs-cls';
import { AuditProvider, AuditEventPayload } from '../interfaces/audit-provider.interface';

@Injectable()
export class PrismaAuditProvider implements AuditProvider {
  private readonly logger = new Logger(PrismaAuditProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async recordEvent(payload: AuditEventPayload): Promise<void> {
    const traceId = this.cls.get('traceId');
    
    try {
      await this.prisma.auditEvent.create({
        data: {
          action: payload.action,
          actorId: payload.actorId,
          resourceId: payload.resourceId,
          metadata: payload.metadata || {},
          ipAddress: payload.ipAddress,
          userAgent: payload.userAgent,
          traceId,
        },
      });
    } catch (error) {
      // We must not crash the main application if audit logging fails,
      // but we need to record this critically in the standard logs.
      this.logger.error(`Failed to persist audit event for action: ${payload.action}`, error);
    }
  }
}
