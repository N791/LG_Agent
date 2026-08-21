import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { SubmissionStatus } from '@lg-agent/contracts';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService contract', () => {
  const createService = () => {
    const prisma = {
      task: { findUnique: jest.fn(), findFirst: jest.fn() },
      submission: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    const executionAdapter = {
      dispatch: jest.fn(),
      cancel: jest.fn(),
      replay: jest.fn(),
    };
    const service = new SubmissionsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      executionAdapter,
      [],
    );
    return { executionAdapter, prisma, service };
  };

  it('returns the active attempt for a repeated request', async () => {
    const { prisma, service } = createService();
    prisma.task.findFirst.mockResolvedValue({ id: 'task-1' });
    prisma.submission.findFirst.mockResolvedValue({ id: 'submission-active' });

    await expect(
      service.submitTask({ id: 'owner', organizationId: 'org-1', role: Role.TRAINEE }, 'task-1'),
    ).resolves.toEqual({
      submissionId: 'submission-active',
      duplicate: true,
    });
    expect(prisma.submission.create).not.toHaveBeenCalled();
  });

  it('does not recover a running attempt with a live worker lease', async () => {
    const { prisma, service } = createService();
    prisma.submission.updateMany = jest.fn();
    await service.recoverInterruptedSubmission({
      id: 'submission-live',
      userId: 'owner',
      taskId: 'task-1',
      status: SubmissionStatus.RUNNING,
      leaseExpiresAt: new Date(Date.now() + 60_000),
    });

    expect(prisma.submission.updateMany).not.toHaveBeenCalled();
  });

  it('reclaims and dispatches a running attempt after its worker lease expires', async () => {
    const { executionAdapter, prisma, service } = createService();
    prisma.submission.updateMany.mockResolvedValue({ count: 1 });

    await service.recoverInterruptedSubmission({
      id: 'submission-expired',
      userId: 'owner',
      taskId: 'task-1',
      status: SubmissionStatus.RUNNING,
      executionOwner: 'dead-worker',
      leaseExpiresAt: new Date(0),
    });

    expect(prisma.submission.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: SubmissionStatus.PENDING,
          executionOwner: null,
        }) as unknown,
      }),
    );
    expect(executionAdapter.dispatch).toHaveBeenCalledTimes(1);
  });

  it('rejects a concurrent state overwrite', async () => {
    const { prisma, service } = createService();
    prisma.submission.findUnique.mockResolvedValue({ status: SubmissionStatus.RUNNING });
    prisma.submission.updateMany.mockResolvedValue({ count: 0 });

    await expect(service.transition('submission-1', SubmissionStatus.PASSED)).rejects.toThrow(
      'errors.submission.concurrentTransition',
    );
  });

  it('allows the owner to read a submission', async () => {
    const { prisma, service } = createService();
    prisma.submission.findFirst.mockResolvedValue({
      id: 'submission-1',
      userId: 'owner',
    });

    await expect(
      service.findOne('submission-1', {
        id: 'owner',
        organizationId: 'org-1',
        role: Role.TRAINEE,
      }),
    ).resolves.toMatchObject({ id: 'submission-1' });
  });

  it('allows mentors to read another user submission', async () => {
    const { prisma, service } = createService();
    prisma.submission.findFirst.mockResolvedValue({
      id: 'submission-1',
      userId: 'owner',
    });

    await expect(
      service.findOne('submission-1', {
        id: 'mentor',
        organizationId: 'org-1',
        role: Role.MENTOR,
      }),
    ).resolves.toMatchObject({ id: 'submission-1' });
  });

  it('rejects a different trainee', async () => {
    const { prisma, service } = createService();
    prisma.submission.findFirst.mockResolvedValue(null);

    await expect(
      service.findOne('submission-1', {
        id: 'intruder',
        organizationId: 'org-1',
        role: Role.TRAINEE,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('forces trainee list queries to the authenticated owner', async () => {
    const { prisma, service } = createService();
    prisma.submission.findMany.mockResolvedValue([]);

    await service.findAll(
      { id: 'owner', organizationId: 'org-1', role: Role.TRAINEE },
      { userId: 'another-user', taskId: 'task-1' },
    );

    expect(prisma.submission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are intentionally typed as any.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        where: expect.objectContaining({ userId: 'owner', taskId: 'task-1' }),
      }),
    );
  });
});
