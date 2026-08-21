import { Injectable, Logger } from '@nestjs/common';
import { SubmissionStatus } from '@lg-agent/contracts';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../common/prisma.service';
import { ExecutionManager } from '../../sandbox';
import { ExecutionJob, IExecutionAdapter } from '../interfaces/execution-adapter.interface';

const LEASE_MS = 30_000;
const HEARTBEAT_MS = 10_000;
const BASE_RETRY_MS = 500;

@Injectable()
export class DatabaseExecutionAdapter implements IExecutionAdapter {
  private readonly logger = new Logger(DatabaseExecutionAdapter.name);
  private readonly workerId = `api-${process.pid.toString()}-${randomUUID()}`;
  private readonly jobs = new Map<string, ExecutionJob>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly executionManager: ExecutionManager,
  ) {}

  async dispatch(job: ExecutionJob): Promise<void> {
    this.jobs.set(job.submissionId, job);
    await this.schedule(job);
  }

  async cancel(submissionId: string): Promise<void> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      select: { executionOwner: true },
    });
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: { cancelRequestedAt: new Date() },
    });
    if (submission?.executionOwner === this.workerId) {
      try {
        this.executionManager.stopInternal(submissionId);
      } catch {
        // A claimed job may not have spawned its sandbox process yet.
      }
    }
    const job = this.jobs.get(submissionId);
    if (job) await job.onCancelled();
    this.jobs.delete(submissionId);
  }

  async replay(submissionId: string, job: ExecutionJob): Promise<void> {
    await this.prisma.submission.update({
      where: { id: submissionId },
      data: {
        status: SubmissionStatus.PENDING,
        retryCount: 0,
        nextAttemptAt: null,
        deadLetteredAt: null,
        failureReason: null,
        finishedAt: null,
        cancelRequestedAt: null,
        executionOwner: null,
        leaseExpiresAt: null,
      },
    });
    await this.dispatch(job);
  }

  private async schedule(job: ExecutionJob): Promise<void> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: job.submissionId },
      select: { nextAttemptAt: true },
    });
    const delay = Math.max(0, (submission?.nextAttemptAt?.getTime() ?? Date.now()) - Date.now());
    const timer = setTimeout(() => void this.claimAndRun(job), delay);
    timer.unref();
  }

  private async claimAndRun(job: ExecutionJob): Promise<void> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + LEASE_MS);
    const claimed = await this.prisma.submission.updateMany({
      where: {
        id: job.submissionId,
        deadLetteredAt: null,
        cancelRequestedAt: null,
        status: { in: [SubmissionStatus.PENDING, SubmissionStatus.RUNNING] },
        AND: [
          { OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }] },
          { OR: [{ executionOwner: null }, { leaseExpiresAt: { lt: now } }] },
        ],
      },
      data: {
        executionOwner: this.workerId,
        heartbeatAt: now,
        leaseExpiresAt,
        attempt: { increment: 1 },
      },
    });
    if (claimed.count !== 1) return;

    const heartbeat = setInterval(() => {
      void (async () => {
        const owned = await this.prisma.submission.findUnique({
          where: { id: job.submissionId },
          select: { executionOwner: true, cancelRequestedAt: true },
        });
        if (owned?.executionOwner !== this.workerId) return;
        if (owned.cancelRequestedAt) {
          try {
            this.executionManager.stopInternal(job.submissionId);
          } catch {
            // The sandbox may already be completing.
          }
          return;
        }
        const released = await this.prisma.submission.updateMany({
          where: { id: job.submissionId, executionOwner: this.workerId },
          data: {
            heartbeatAt: new Date(),
            leaseExpiresAt: new Date(Date.now() + LEASE_MS),
          },
        });
        if (released.count !== 1) {
          this.jobs.delete(job.submissionId);
          return;
        }
      })();
    }, HEARTBEAT_MS);
    heartbeat.unref();

    try {
      const lease = await this.prisma.submission.findUniqueOrThrow({
        where: { id: job.submissionId },
        select: { attempt: true },
      });
      await job.execute({ ownerId: this.workerId, attempt: lease.attempt });
      this.jobs.delete(job.submissionId);
    } catch (error: unknown) {
      const reason = (error as Error).message;
      const current = await this.prisma.submission.findUnique({
        where: { id: job.submissionId },
        select: {
          retryCount: true,
          maxRetries: true,
          cancelRequestedAt: true,
          executionOwner: true,
        },
      });
      if (current && current.executionOwner !== this.workerId) {
        this.logger.warn(`Discarding stale delivery for submission ${job.submissionId}.`);
        this.jobs.delete(job.submissionId);
      } else if (current?.cancelRequestedAt) {
        await job.onCancelled();
        this.jobs.delete(job.submissionId);
      } else if (current && current.retryCount < current.maxRetries) {
        const retryCount = current.retryCount + 1;
        const nextAttemptAt = new Date(Date.now() + BASE_RETRY_MS * 2 ** current.retryCount);
        await this.prisma.submission.updateMany({
          where: { id: job.submissionId, executionOwner: this.workerId },
          data: {
            status: SubmissionStatus.PENDING,
            retryCount,
            nextAttemptAt,
            failureReason: reason,
            executionOwner: null,
            leaseExpiresAt: null,
          },
        });
        this.logger.warn(
          `Submission ${job.submissionId} retry ${retryCount.toString()} scheduled.`,
        );
        await this.schedule(job);
      } else {
        const deadLettered = await this.prisma.submission.updateMany({
          where: { id: job.submissionId, executionOwner: this.workerId },
          data: { deadLetteredAt: new Date(), failureReason: reason },
        });
        if (deadLettered.count === 1) await job.onDeadLetter(reason);
        this.jobs.delete(job.submissionId);
      }
    } finally {
      clearInterval(heartbeat);
    }
  }
}
