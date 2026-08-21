import type { AuditEventPayload, AuditWriter } from '../../../common/audit';

/** @deprecated Import AUDIT_WRITER from common/audit for new consumers. */
export const AUDIT_PROVIDER = 'AUDIT_PROVIDER';
export type { AuditEventPayload };
export type AuditProvider = AuditWriter;
