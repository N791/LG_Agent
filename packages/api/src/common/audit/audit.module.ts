import { Module } from '@nestjs/common';
import { AUDIT_WRITER } from './audit.types';
import { PrismaAuditWriter } from './prisma-audit-writer.service';

@Module({
  providers: [PrismaAuditWriter, { provide: AUDIT_WRITER, useExisting: PrismaAuditWriter }],
  exports: [AUDIT_WRITER],
})
export class AuditModule {}
