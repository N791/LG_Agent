import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';

export interface IndexJobProgress {
  jobId: string;
  organizationId: string;
  kind: 'DOCUMENT' | 'CODE';
  status: 'RUNNING' | 'READY' | 'FAILED';
  progress: number;
  retryCount: number;
  indexVersion: string;
  contentHash: string;
  startedAt: string;
  completedAt?: string;
  buildDurationMs?: number;
  failureCategory?: string;
}

@Injectable()
export class IndexJobObservabilityService {
  private readonly jobs = new Map<string, IndexJobProgress>();
  private readonly starts = new Map<string, number>();

  start(input: {
    jobId: string;
    organizationId: string;
    kind: 'DOCUMENT' | 'CODE';
    indexVersion: string;
    content: string;
    retryCount?: number;
  }): void {
    this.starts.set(input.jobId, Date.now());
    this.jobs.set(input.jobId, {
      jobId: input.jobId,
      organizationId: input.organizationId,
      kind: input.kind,
      status: 'RUNNING',
      progress: 0,
      retryCount: input.retryCount ?? 0,
      indexVersion: input.indexVersion,
      contentHash: createHash('sha256').update(input.content).digest('hex'),
      startedAt: new Date().toISOString(),
    });
  }

  progress(jobId: string, progress: number): void {
    const job = this.jobs.get(jobId);
    if (job?.status === 'RUNNING') job.progress = Math.min(99, Math.max(job.progress, progress));
  }

  complete(jobId: string): void {
    this.finish(jobId, 'READY');
  }

  fail(jobId: string, error: unknown): void {
    this.finish(jobId, 'FAILED', this.classify(error));
  }

  get(jobId: string, organizationId: string): IndexJobProgress | undefined {
    const job = this.jobs.get(jobId);
    return job?.organizationId === organizationId ? { ...job } : undefined;
  }

  private finish(jobId: string, status: 'READY' | 'FAILED', failureCategory?: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    const completed = Date.now();
    job.status = status;
    job.progress = status === 'READY' ? 100 : job.progress;
    job.completedAt = new Date(completed).toISOString();
    job.buildDurationMs = completed - (this.starts.get(jobId) ?? completed);
    if (failureCategory) job.failureCategory = failureCategory;
    this.starts.delete(jobId);
  }

  private classify(error: unknown): string {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error);
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('embedding')) return 'EMBEDDING';
    if (message.includes('parse')) return 'PARSER';
    if (message.includes('database') || message.includes('prisma')) return 'STORAGE';
    return 'UNKNOWN';
  }
}
