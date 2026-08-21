import { Inject, Injectable } from '@nestjs/common';
import { AUDIT_WRITER, type AuditEventPayload, type AuditWriter } from '../../common/audit';

export type AuthorizationAuditPayload = AuditEventPayload;

@Injectable()
export class AuthorizationAuditService {
  constructor(@Inject(AUDIT_WRITER) private readonly writer: AuditWriter) {}

  async recordEvent(payload: AuthorizationAuditPayload): Promise<void> {
    await this.writer.recordEvent(payload);
  }
}
