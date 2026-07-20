export const AUDIT_PROVIDER = 'AUDIT_PROVIDER';

export interface AuditEventPayload {
  action: string;
  actorId?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditProvider {
  /**
   * Records an auditable business event (e.g. login, export, permission change).
   */
  recordEvent(payload: AuditEventPayload): Promise<void>;
}
