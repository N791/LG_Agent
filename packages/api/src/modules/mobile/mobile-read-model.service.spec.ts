import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import {
  MOBILE_READ_MODEL_VERSION,
  MobileNextActionType,
  MobileTaskStage,
  MobileTaskStatus,
  SubmissionStatus,
} from '@lg-agent/contracts';
import type { PrismaService } from '../../common/prisma.service';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { MobileReadModelService } from './mobile-read-model.service';

describe('MobileReadModelService', () => {
  const actor: TenantActor = {
    id: 'user-1',
    organizationId: 'org-1',
    role: Role.TRAINEE,
  };

  const prisma = {
    courseEnrollment: { findFirst: jest.fn() },
    task: { findFirst: jest.fn(), findMany: jest.fn() },
    submission: { findFirst: jest.fn() },
    notification: { count: jest.fn(), findFirst: jest.fn() },
  };

  let service: MobileReadModelService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MobileReadModelService(prisma as unknown as PrismaService);
  });

  it('binds task detail to permission-compatible organization and enrollment resource policy', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      courseId: 'course-1',
      title: 'Repair the gateway check',
      summary: 'Resolve the failing authorization contract.',
      description: 'Use the existing policy boundary.',
      stage: 4,
      version: 3,
      metadata: {
        requiresPc: true,
        knowledgeCards: [{ id: 'card-1', title: 'Organization scope', estimatedMinutes: 4 }],
      },
      submissions: [],
    });

    const detail = await service.getTask(actor, 'task-1');

    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'task-1',
          course: {
            organizationId: 'org-1',
            courseEnrollments: {
              some: { userId: 'user-1', status: { not: 'DROPPED' } },
            },
          },
        },
      }),
    );
    expect(detail).toMatchObject({
      status: MobileTaskStatus.IN_PROGRESS,
      currentStage: MobileTaskStage.HANDS_ON_CODING,
      requiresPc: true,
      nextAction: { type: MobileNextActionType.CONTINUE_ON_PC },
      knowledgeCards: [{ id: 'card-1', title: 'Organization scope', estimatedMinutes: 4 }],
    });
    expect(detail.stages).toHaveLength(6);
  });

  it('returns the same not-found shape for unassigned and cross-organization tasks', async () => {
    prisma.task.findFirst.mockResolvedValue(null);

    await expect(service.getTask(actor, 'outside-task')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('redacts raw logs and maps a failed submission to conclusion, cause, and action', async () => {
    prisma.submission.findFirst.mockResolvedValue({
      id: 'submission-1',
      taskId: 'task-1',
      status: SubmissionStatus.FAILED,
      score: 35,
      attempt: 2,
      report: {
        primaryCause: 'The organization predicate is missing.\nCheck the scoped query.',
        failedChecks: ['tenant-isolation'],
        actions: ['Add the organization filter before loading the record.'],
        logs: 'SECRET RAW LOG',
      },
      failureReason: 'fallback reason',
      logs: 'SECRET RAW LOG',
      startedAt: new Date('2026-08-01T10:00:00.000Z'),
      finishedAt: new Date('2026-08-01T10:01:00.000Z'),
    });

    const summary = await service.getSubmissionSummary(actor, 'submission-1');

    const submissionCalls = prisma.submission.findFirst.mock.calls as unknown[][];
    const submissionQuery = submissionCalls[0]?.[0];
    expect(submissionQuery).toMatchObject({
      where: {
        id: 'submission-1',
        userId: 'user-1',
        user: { organizationId: 'org-1' },
      },
    });
    expect(summary).toMatchObject({
      readModelVersion: MOBILE_READ_MODEL_VERSION,
      status: SubmissionStatus.FAILED,
      failure: {
        conclusion: 'FAILED',
        primaryCause: 'The organization predicate is missing. Check the scoped query.',
        affectedChecks: ['tenant-isolation'],
      },
    });
    expect(JSON.stringify(summary)).not.toContain('SECRET RAW LOG');
    expect(summary.failure?.actions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'ASK_AI', requiresPc: false }),
        expect.objectContaining({ kind: 'CONTINUE_ON_PC', requiresPc: true }),
      ]),
    );
  });

  it('uses a stable opaque cursor after deriving mobile task state', async () => {
    prisma.task.findMany.mockResolvedValue(
      ['task-1', 'task-2', 'task-3'].map((id, index) => ({
        id,
        courseId: 'course-1',
        title: `Task ${String(index + 1)}`,
        summary: null,
        description: null,
        stage: index + 1,
        version: 1,
        metadata: null,
        submissions: [],
      })),
    );

    const first = await service.getTasks(actor, { limit: 2 });
    const second = await service.getTasks(actor, { limit: 2, cursor: first.nextCursor });

    expect(first.items.map((item) => item.id)).toEqual(['task-1', 'task-2']);
    expect(first.nextCursor).toBeDefined();
    expect(second.items.map((item) => item.id)).toEqual(['task-3']);
    expect(second.nextCursor).toBeUndefined();
    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          course: {
            organizationId: 'org-1',
            courseEnrollments: {
              some: { userId: 'user-1', status: { not: 'DROPPED' } },
            },
          },
        },
      }),
    );
  });
});
