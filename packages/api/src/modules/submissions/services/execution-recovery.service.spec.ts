import { SubmissionStatus } from '@lg-agent/contracts';
import { ExecutionRecoveryService } from './execution-recovery.service';

describe('ExecutionRecoveryService', () => {
  it('hands pending and running submissions to lease-aware recovery', async () => {
    const interrupted = [
      {
        id: 'pending',
        userId: 'user-1',
        taskId: 'task-1',
        status: SubmissionStatus.PENDING,
        leaseExpiresAt: null,
      },
      {
        id: 'expired',
        userId: 'user-1',
        taskId: 'task-1',
        status: SubmissionStatus.RUNNING,
        leaseExpiresAt: new Date(0),
      },
    ];
    const prisma = {
      submission: { findMany: jest.fn().mockResolvedValue(interrupted) },
    };
    const submissions = {
      recoverInterruptedSubmission: jest.fn().mockResolvedValue(undefined),
    };
    const service = new ExecutionRecoveryService(prisma as never, submissions as never);

    await service.onModuleInit();

    expect(submissions.recoverInterruptedSubmission).toHaveBeenCalledTimes(2);
  });
});
