import { ServiceUnavailableException } from '@nestjs/common';
import { AuthorizationAuditService } from '../../modules/authorization/authorization-audit.service';
import { PrismaAuditProvider } from '../../modules/observability/providers/prisma-audit.provider';
import { PrismaAuditWriter } from './prisma-audit-writer.service';

describe('Epic 81 shared audit writer contract', () => {
  it('propagates one context contract for authorization and observability consumers', async () => {
    const prisma = { auditEvent: { create: jest.fn().mockResolvedValue({}) } };
    const cls = {
      get: jest.fn((key: string) => (key === 'reqId' ? 'request-1' : 'trace-1')),
    };
    const writer = new PrismaAuditWriter(prisma as never, cls as never);
    const authorization = new AuthorizationAuditService(writer);
    const observability = new PrismaAuditProvider(writer);

    await authorization.recordEvent({
      action: 'authorization.denied',
      actorId: '00000000-0000-0000-0000-000000000001',
      organizationId: '00000000-0000-0000-0000-000000000002',
      before: { permission: true },
      after: { permission: false },
      ipAddress: '127.0.0.1',
      userAgent: 'contract-test',
    });
    await observability.recordEvent({
      action: 'observability.exported',
      organizationId: '00000000-0000-0000-0000-000000000002',
    });

    expect(prisma.auditEvent.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          requestId: 'request-1',
          traceId: 'trace-1',
          organizationId: '00000000-0000-0000-0000-000000000002',
          before: { permission: true },
          after: { permission: false },
          ipAddress: '127.0.0.1',
          userAgent: 'contract-test',
        }) as object,
      }),
    );
    expect(prisma.auditEvent.create).toHaveBeenCalledTimes(2);
  });

  it('degrades best-effort denial audit but surfaces required high-risk audit failure', async () => {
    const prisma = {
      auditEvent: { create: jest.fn().mockRejectedValue(new Error('database unavailable')) },
    };
    const writer = new PrismaAuditWriter(prisma as never, { get: jest.fn() } as never);

    await expect(
      writer.recordEvent({
        action: 'authorization.denied',
        severity: 'SECURITY',
        failureMode: 'BEST_EFFORT',
      }),
    ).resolves.toBeUndefined();
    await expect(
      writer.recordEvent({
        action: 'authorization.role.permissions_changed',
        severity: 'SECURITY',
        failureMode: 'REQUIRED',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
