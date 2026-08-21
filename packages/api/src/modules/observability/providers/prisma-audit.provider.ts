import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_WRITER, type AuditWriter } from '../../../common/audit';
import { AuditProvider, AuditEventPayload } from '../interfaces/audit-provider.interface';

/** Compatibility adapter. The shared AuditModule owns persistence and context. */
@Injectable()
export class PrismaAuditProvider implements AuditProvider {
  constructor(@Inject(AUDIT_WRITER) private readonly writer: AuditWriter) {}

  async recordEvent(payload: AuditEventPayload): Promise<void> {
    await this.writer.recordEvent(payload);
  }
}
