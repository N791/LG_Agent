import { Injectable } from '@nestjs/common';
import { ExecutionManager } from '../../sandbox/execution.manager';
import { ExecutionJob, IExecutionAdapter } from '../interfaces/execution-adapter.interface';

@Injectable()
export class InProcessExecutionAdapter implements IExecutionAdapter {
  private readonly jobs = new Map<string, ExecutionJob>();
  private readonly cancelled = new Set<string>();
  private readonly maxRetries = 3;

  constructor(private readonly executionManager: ExecutionManager) {}

  dispatch(job: ExecutionJob): Promise<void> {
    if (this.jobs.has(job.submissionId)) return Promise.resolve();
    this.jobs.set(job.submissionId, job);
    setImmediate(() => void this.run(job, 0));
    return Promise.resolve();
  }

  cancel(submissionId: string): Promise<void> {
    this.cancelled.add(submissionId);
    try {
      this.executionManager.stopInternal(submissionId);
    } catch {
      // The job can be waiting or between attempts and has no child process yet.
    }
    return Promise.resolve();
  }

  async replay(submissionId: string, job: ExecutionJob): Promise<void> {
    this.cancelled.delete(submissionId);
    this.jobs.delete(submissionId);
    await this.dispatch(job);
  }

  private async run(job: ExecutionJob, retry: number): Promise<void> {
    try {
      if (this.cancelled.has(job.submissionId)) {
        await job.onCancelled();
        return;
      }
      await job.execute();
      this.jobs.delete(job.submissionId);
    } catch (error: unknown) {
      if (this.cancelled.has(job.submissionId)) {
        await job.onCancelled();
      } else if (retry < this.maxRetries) {
        const timer = setTimeout(() => void this.run(job, retry + 1), 100 * 2 ** retry);
        timer.unref();
        return;
      } else {
        await job.onDeadLetter((error as Error).message);
        this.jobs.delete(job.submissionId);
      }
    }
  }
}
