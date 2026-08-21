import { DataLifecycleService } from './data-lifecycle.service';

describe('DataLifecycleService', () => {
  it('runs bounded cleanup for every governed high-volume table', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (operations: Promise<number>[]) => Promise.all(operations)),
    };
    const service = new DataLifecycleService(prisma as never, { policy: policy() } as never);

    const result = await service.runRetention(new Date('2026-07-28T00:00:00.000Z'));

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(10);
    expect(result).toEqual({
      workspaceVersions: 1,
      conversationMessages: 1,
      llmRequestLogs: 1,
      llmAuditLogs: 1,
      auditEvents: 1,
      clientLogs: 1,
      clientMetrics: 1,
      retrievalEvidence: 1,
      retrievalTraces: 1,
      conversationSummaries: 1,
    });
  });

  it('does nothing when lifecycle execution is disabled', async () => {
    const prisma = { $executeRaw: jest.fn(), $transaction: jest.fn() };
    const service = new DataLifecycleService(
      prisma as never,
      { policy: policy({ enabled: false }) } as never,
    );

    await expect(service.runRetention()).resolves.toEqual({});
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

function policy(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    batchSize: 100,
    workspaceVersionMaxCount: 50,
    workspaceVersionRetentionDays: 90,
    conversationRetentionDays: 365,
    llmRequestRetentionDays: 180,
    llmAuditRetentionDays: 365,
    auditEventRetentionDays: 2_555,
    clientLogRetentionDays: 30,
    clientMetricRetentionDays: 90,
    submissionArchiveThresholdBytes: 262_144,
    ...overrides,
  };
}
