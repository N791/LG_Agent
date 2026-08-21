import { AiAuditService } from './ai-audit.service';

describe('AiAuditService', () => {
  it('redacts credential-shaped metadata recursively', () => {
    const service = new AiAuditService({} as never);

    expect(
      service.sanitizeMetadata({
        apiKey: 'secret',
        nested: { authorization: 'Bearer token', safe: 'visible' },
      }),
    ).toEqual({
      apiKey: '[REDACTED]',
      nested: { authorization: '[REDACTED]', safe: 'visible' },
    });
  });

  it('enforces organization scope and bounded audit reads', async () => {
    const prisma = {
      llmRequestLog: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new AiAuditService(prisma as never);

    await service.listForOrganization('org-1', 5_000);

    expect(prisma.llmRequestLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-1' }, take: 500 }),
    );
  });
});
