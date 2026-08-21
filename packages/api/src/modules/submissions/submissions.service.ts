import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  ExecutionEventType,
  SubmissionStatus,
  type RunSubmissionResponseDTO,
} from '@lg-agent/contracts';
import { PrismaService } from '../../common/prisma.service';
import { SandboxService } from '../sandbox';
import { AuthoringWorkspaceService } from '../workspace';
import { EXECUTION_EVENT_BUS } from './interfaces/execution-event-bus.interface';
import type { IExecutionEventBus } from './interfaces/execution-event-bus.interface';
import {
  EXECUTION_ADAPTER,
  type ExecutionLease,
  type ExecutionJob,
  type IExecutionAdapter,
} from './interfaces/execution-adapter.interface';
import {
  SUBMISSION_TERMINAL_HOOKS,
  type ISubmissionTerminalHook,
  type SubmissionTerminalContext,
} from './interfaces/submission-terminal-hook.interface';
import { SubmissionStateMachine, TERMINAL_SUBMISSION_STATUSES } from './submission-state-machine';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { TenantScopeService } from '../../common/tenant/tenant-scope.service';

export type SubmissionActor = TenantActor;

@Injectable()
export class SubmissionsService {
  private readonly logger = new Logger(SubmissionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly sandbox: SandboxService,
    private readonly workspaceService: AuthoringWorkspaceService,
    @Inject(EXECUTION_EVENT_BUS) private readonly eventBus: IExecutionEventBus,
    @Inject(EXECUTION_ADAPTER) private readonly executionAdapter: IExecutionAdapter,
    @Inject(SUBMISSION_TERMINAL_HOOKS)
    private readonly terminalHooks: ISubmissionTerminalHook[],
    private readonly tenantScope: TenantScopeService = new TenantScopeService(prisma),
  ) {}

  async findAll(
    actor: SubmissionActor,
    query: { userId?: string; courseId?: string; taskId?: string },
  ) {
    const userId = actor.role === Role.TRAINEE ? actor.id : query.userId;
    return this.prisma.submission.findMany({
      where: {
        ...this.tenantScope.submission(actor),
        ...(userId && { userId }),
        ...(query.taskId && { taskId: query.taskId }),
        ...(query.courseId && { task: { courseId: query.courseId } }),
      },
      include: {
        user: { select: { id: true, username: true } },
        task: { select: { id: true, title: true, courseId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, actor: SubmissionActor) {
    const submission = await this.prisma.submission.findFirst({
      where: {
        id,
        ...this.tenantScope.submission(actor),
        ...(actor.role === Role.TRAINEE && { userId: actor.id }),
      },
      include: {
        user: { select: { id: true, username: true } },
        task: { select: { id: true, title: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException({ message: 'errors.submission.notFound', args: { id } });
    }
    return submission;
  }

  async assertSubmissionAccess(id: string, actor: SubmissionActor): Promise<void> {
    const submission = await this.prisma.submission.findFirst({
      where: {
        id,
        ...this.tenantScope.submission(actor),
        ...(actor.role === Role.TRAINEE && { userId: actor.id }),
      },
      select: { userId: true },
    });
    if (!submission) {
      throw new NotFoundException({ message: 'errors.submission.notFound', args: { id } });
    }
  }

  async submitTask(
    actor: SubmissionActor,
    taskId: string,
    idempotencyKey?: string,
  ): Promise<RunSubmissionResponseDTO> {
    await this.tenantScope.assertTask(taskId, actor);
    const userId = actor.id;

    const durableKey = idempotencyKey ? `${userId}:${idempotencyKey}` : null;
    if (durableKey) {
      const duplicate = await this.prisma.submission.findUnique({
        where: { idempotencyKey: durableKey },
        select: { id: true },
      });
      if (duplicate) return { submissionId: duplicate.id, duplicate: true };
    }

    const active = await this.prisma.submission.findFirst({
      where: {
        userId,
        taskId,
        status: { in: [SubmissionStatus.PENDING, SubmissionStatus.RUNNING] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (active) {
      return { submissionId: active.id, duplicate: true };
    }

    let submission: { id: string };
    try {
      submission = await this.prisma.submission.create({
        data: {
          userId,
          taskId,
          idempotencyKey: durableKey ?? `${userId}:auto:${randomUUID()}`,
          status: SubmissionStatus.PENDING,
          nextAttemptAt: new Date(),
        },
        select: { id: true },
      });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const duplicate = durableKey
          ? await this.prisma.submission.findUnique({
              where: { idempotencyKey: durableKey },
              select: { id: true },
            })
          : await this.prisma.submission.findFirst({
              where: {
                userId,
                taskId,
                status: { in: [SubmissionStatus.PENDING, SubmissionStatus.RUNNING] },
              },
              orderBy: { createdAt: 'desc' },
              select: { id: true },
            });
        if (duplicate) return { submissionId: duplicate.id, duplicate: true };
      }
      throw error;
    }

    await this.executionAdapter.dispatch(this.createExecutionJob(submission.id, userId, taskId));

    return { submissionId: submission.id, duplicate: false };
  }

  async transition(
    submissionId: string,
    to: SubmissionStatus,
    data: {
      score?: number;
      logs?: string;
      report?: Record<string, unknown> | null;
      failureReason?: string | null;
    } = {},
    lease?: ExecutionLease,
  ): Promise<void> {
    const current = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { status: true },
    });
    if (!current) {
      throw new NotFoundException({
        message: 'errors.submission.notFound',
        args: { id: submissionId },
      });
    }

    const from = current.status as SubmissionStatus;
    SubmissionStateMachine.assertTransition(from, to);
    const result = await this.prisma.submission.updateMany({
      where: {
        id: submissionId,
        status: from,
        ...(lease && { executionOwner: lease.ownerId, attempt: lease.attempt }),
      },
      data: {
        status: to,
        ...(data.score !== undefined && { score: data.score }),
        ...(data.logs !== undefined && { logs: data.logs }),
        // Prisma's generated JSON input type does not accept a generic record.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
        ...(data.report !== undefined && { report: data.report as any }),
        ...(data.failureReason !== undefined && { failureReason: data.failureReason }),
        ...(to === SubmissionStatus.RUNNING && { startedAt: new Date() }),
        ...(TERMINAL_SUBMISSION_STATUSES.has(to) && {
          finishedAt: new Date(),
          executionOwner: null,
          leaseExpiresAt: null,
          heartbeatAt: null,
        }),
      },
    });
    if (result.count !== 1) {
      throw new ConflictException({ message: 'errors.submission.concurrentTransition' });
    }
  }

  private async runBackground(
    submissionId: string,
    userId: string,
    taskId: string,
    lease?: ExecutionLease,
  ): Promise<void> {
    let logs = '';
    let score = 0;

    try {
      const queuedSubmission = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        select: { createdAt: true },
      });
      const workspace = await this.workspaceService.getWorkspace(taskId, userId);
      await this.workspaceService.createVersion(taskId, userId, 'SUBMIT');
      await this.transition(submissionId, SubmissionStatus.RUNNING, {}, lease);

      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: {
          testConfig: true,
          envConfig: true,
          course: { select: { organizationId: true } },
        },
      });
      if (!task) {
        throw new NotFoundException({ message: 'errors.task.notFound', args: { id: taskId } });
      }
      const queuedAt = queuedSubmission
        ? (queuedSubmission.createdAt as Date | undefined)
        : undefined;
      const config = {
        testScript: (task.testConfig as { script?: string } | null)?.script ?? null,
        env: task.envConfig as import('../sandbox/env-detector.service').EnvRequirement | null,
        runtime:
          (
            task.envConfig as {
              runtime?: Partial<import('@lg-agent/contracts').RuntimeEnvironmentDTO>;
            } | null
          )?.runtime ?? null,
        executionId: submissionId,
        organizationId: task.course.organizationId,
        queuedAtMs: queuedAt?.getTime(),
      };

      let passed = false;
      let report: Record<string, unknown> | null = null;
      const stream = this.sandbox.runTask(taskId, userId, workspace, config);

      for await (const event of stream) {
        await this.assertExecutionLease(submissionId, lease);
        await this.eventBus.publish(submissionId, event);
        if (event.type === ExecutionEventType.LOG) {
          logs += (event.data as { text?: string } | undefined)?.text ?? '';
        } else if (
          event.type === ExecutionEventType.SUCCESS ||
          event.type === ExecutionEventType.FAILED
        ) {
          const result = event.data as
            { passed?: boolean; score?: number; report?: Record<string, unknown> } | undefined;
          passed = result?.passed ?? event.type === ExecutionEventType.SUCCESS;
          score = result?.score ?? 0;
          report = result?.report ?? null;
        }
      }

      const cancellation = await this.prisma.submission.findUnique({
        where: { id: submissionId },
        select: { cancelRequestedAt: true },
      });
      if (cancellation?.cancelRequestedAt) {
        throw new Error('Execution cancellation requested.');
      }

      const status = passed ? SubmissionStatus.PASSED : SubmissionStatus.FAILED;
      await this.assertExecutionLease(submissionId, lease);
      await this.finish({ submissionId, userId, taskId, status, score, logs }, { report }, lease);
      await this.eventBus.complete(submissionId);
    } catch (error: unknown) {
      const message = (error as Error).message;
      this.logger.error(`Execution error for submission ${submissionId}: ${message}`);
      await this.eventBus.publish(submissionId, {
        type: ExecutionEventType.ERROR,
        message,
        timestamp: new Date().toISOString(),
      });
      throw error;
    }
  }

  private async finish(
    context: SubmissionTerminalContext,
    data: {
      report?: Record<string, unknown> | null;
      failureReason?: string | null;
    } = {},
    lease?: ExecutionLease,
  ): Promise<void> {
    await this.transition(
      context.submissionId,
      context.status,
      {
        score: context.score,
        logs: context.logs,
        report: data.report,
        failureReason: data.failureReason,
      },
      lease,
    );

    const results = await Promise.allSettled(
      this.terminalHooks.map((hook) => hook.afterTerminal(context)),
    );
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Terminal hook ${this.terminalHooks[index]?.constructor.name ?? String(index)} failed for submission ${context.submissionId}: ${String(result.reason)}`,
        );
      }
    });
  }

  async streamSubmissionLogs(submissionId: string, actor: SubmissionActor, afterSequence = 0) {
    await this.assertSubmissionAccess(submissionId, actor);
    return this.eventBus.subscribe(submissionId, afterSequence);
  }

  async recoverInterruptedSubmission(submission: {
    id: string;
    userId: string;
    taskId: string;
    status: string;
    executionOwner?: string | null;
    leaseExpiresAt?: Date | null;
  }): Promise<void> {
    const status = submission.status as SubmissionStatus;
    if (TERMINAL_SUBMISSION_STATUSES.has(status)) return;
    if (submission.leaseExpiresAt && submission.leaseExpiresAt.getTime() > Date.now()) return;
    const now = new Date();
    const recovered = await this.prisma.submission.updateMany({
      where: {
        id: submission.id,
        status: { in: [SubmissionStatus.PENDING, SubmissionStatus.RUNNING] },
        OR: [{ executionOwner: null }, { leaseExpiresAt: null }, { leaseExpiresAt: { lte: now } }],
      },
      data: {
        status: SubmissionStatus.PENDING,
        executionOwner: null,
        leaseExpiresAt: null,
        nextAttemptAt: new Date(),
      },
    });
    if (recovered.count !== 1) return;
    await this.executionAdapter.dispatch(
      this.createExecutionJob(submission.id, submission.userId, submission.taskId),
    );
  }

  async cancelSubmission(id: string, actor: SubmissionActor): Promise<void> {
    await this.assertSubmissionAccess(id, actor);
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      select: { status: true, userId: true, taskId: true },
    });
    if (!submission || TERMINAL_SUBMISSION_STATUSES.has(submission.status as SubmissionStatus))
      return;
    await this.executionAdapter.cancel(id);
  }

  async replaySubmission(id: string, actor: SubmissionActor): Promise<void> {
    const submission = await this.prisma.submission.findFirst({
      where: { id, ...this.tenantScope.submission(actor) },
      select: { userId: true, taskId: true, deadLetteredAt: true },
    });
    if (!submission) {
      throw new NotFoundException({ message: 'errors.submission.notFound', args: { id } });
    }
    this.assertCanAccess(submission.userId, actor);
    if (!submission.deadLetteredAt) {
      throw new ConflictException({ message: 'errors.submission.notDeadLettered' });
    }
    const job = this.createExecutionJob(id, submission.userId, submission.taskId);
    await this.executionAdapter.replay(id, job);
  }

  private createExecutionJob(submissionId: string, userId: string, taskId: string): ExecutionJob {
    return {
      submissionId,
      execute: (lease) => this.runBackground(submissionId, userId, taskId, lease),
      onDeadLetter: (reason) => this.failExecution(submissionId, userId, taskId, reason),
      onCancelled: () => this.cancelExecution(submissionId, userId, taskId),
    };
  }

  private async assertExecutionLease(submissionId: string, lease?: ExecutionLease): Promise<void> {
    if (!lease) return;
    const owned = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { executionOwner: true, attempt: true },
    });
    if (owned?.executionOwner !== lease.ownerId || owned.attempt !== lease.attempt) {
      throw new ConflictException({ message: 'errors.submission.executionLeaseLost' });
    }
  }

  private async failExecution(
    submissionId: string,
    userId: string,
    taskId: string,
    reason: string,
  ): Promise<void> {
    const current = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { status: true, logs: true },
    });
    if (!current || TERMINAL_SUBMISSION_STATUSES.has(current.status as SubmissionStatus)) return;
    await this.finish(
      {
        submissionId,
        userId,
        taskId,
        status: SubmissionStatus.ERROR,
        score: 0,
        logs: current.logs ? `${current.logs}\n${reason}` : reason,
      },
      { failureReason: reason },
    );
    await this.eventBus.complete(submissionId);
  }

  private async cancelExecution(
    submissionId: string,
    userId: string,
    taskId: string,
  ): Promise<void> {
    const current = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { status: true },
    });
    if (!current || TERMINAL_SUBMISSION_STATUSES.has(current.status as SubmissionStatus)) return;
    await this.finish({
      submissionId,
      userId,
      taskId,
      status: SubmissionStatus.CANCELLED,
      score: 0,
      logs: 'Execution cancelled by user.',
    });
    await this.eventBus.complete(submissionId);
  }

  private assertCanAccess(ownerId: string, actor: SubmissionActor): void {
    if (actor.id !== ownerId && actor.role !== Role.MENTOR && actor.role !== Role.ADMIN) {
      throw new ForbiddenException('errors.submission.forbidden');
    }
  }
}
