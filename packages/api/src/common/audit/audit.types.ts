export const AUDIT_WRITER = Symbol('AUDIT_WRITER');
export const AUDIT_PERSISTENCE_ERROR_CODE = 'AUDIT_EVENT_PERSISTENCE_FAILED';

export type AuditFailureMode = 'BEST_EFFORT' | 'REQUIRED';

export interface AuditEventPayload {
  action: string;
  actorId?: string;
  organizationId?: string;
  resourceId?: string;
  requestId?: string;
  traceId?: string;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  failureMode?: AuditFailureMode;
  severity?: 'INFO' | 'SECURITY';
}

export interface AuditWriter {
  recordEvent(payload: AuditEventPayload): Promise<void>;
}
