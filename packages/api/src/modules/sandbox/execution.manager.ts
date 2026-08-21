import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import type { ChildProcess } from 'child_process';
import type { SandboxAction } from '@lg-agent/contracts';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { SandboxSecurityConfig } from './sandbox-security.config';

interface ExecutionRecord {
  userId: string;
  organizationId: string;
  taskId?: string;
  action?: SandboxAction;
  process?: ChildProcess;
}

@Injectable()
export class ExecutionManager {
  private readonly logger = new Logger(ExecutionManager.name);
  private readonly executions = new Map<string, ExecutionRecord>();

  constructor(
    private readonly securityConfig: SandboxSecurityConfig = {
      policy: { userConcurrency: 2, organizationConcurrency: 10 },
    } as SandboxSecurityConfig,
  ) {}

  reserve(executionId: string, actor: TenantActor, taskId?: string, action?: SandboxAction): void {
    if (this.executions.has(executionId)) {
      throw new ConflictException('errors.sandbox.executionAlreadyExists');
    }
    this.assertQuota(actor.id, actor.organizationId);
    this.executions.set(executionId, {
      userId: actor.id,
      organizationId: actor.organizationId,
      taskId,
      action,
    });
  }

  claim(executionId: string, actor: TenantActor, taskId?: string, action?: SandboxAction): void {
    const record = this.getAuthorized(executionId, actor);
    if (
      (record.taskId && record.taskId !== taskId) ||
      (record.action && record.action !== action)
    ) {
      throw new ForbiddenException('errors.sandbox.executionContextMismatch');
    }
  }

  acquire(
    executionId: string,
    userId: string,
    organizationId: string,
    taskId?: string,
    action?: SandboxAction,
  ): void {
    const existing = this.executions.get(executionId);
    if (existing) {
      if (existing.userId !== userId || existing.organizationId !== organizationId) {
        throw new ForbiddenException('errors.sandbox.executionForbidden');
      }
      return;
    }
    this.assertQuota(userId, organizationId);
    this.executions.set(executionId, { userId, organizationId, taskId, action });
  }

  register(
    executionId: string,
    childProcess: ChildProcess,
    userId = 'internal',
    organizationId = 'internal',
  ): void {
    this.acquire(executionId, userId, organizationId);
    const record = this.executions.get(executionId);
    if (record) record.process = childProcess;
    this.logger.debug(`Execution ${executionId} registered.`);
  }

  unregister(executionId: string): void {
    this.executions.delete(executionId);
    this.logger.debug(`Execution ${executionId} unregistered.`);
  }

  stop(executionId: string, actor: TenantActor): void {
    const record = this.getAuthorized(executionId, actor);
    this.stopRecord(executionId, record);
  }

  stopInternal(executionId: string): void {
    const record = this.executions.get(executionId);
    if (!record) {
      throw new NotFoundException({
        message: 'errors.sandbox.executionNotFound',
        args: { id: executionId },
      });
    }
    this.stopRecord(executionId, record);
  }

  private stopRecord(executionId: string, record: ExecutionRecord): void {
    const child = record.process;
    if (!child) {
      this.executions.delete(executionId);
      return;
    }

    this.logger.log(`Stopping execution ${executionId}...`);
    child.kill('SIGTERM');
    setTimeout(() => {
      if (this.executions.has(executionId)) child.kill('SIGKILL');
    }, 2000);
  }

  private getAuthorized(executionId: string, actor: TenantActor): ExecutionRecord {
    const record = this.executions.get(executionId);
    if (!record) {
      throw new NotFoundException({
        message: 'errors.sandbox.executionNotFound',
        args: { id: executionId },
      });
    }
    const sameOrganization = record.organizationId === actor.organizationId;
    const isOwner = record.userId === actor.id;
    const privileged = actor.role === Role.ADMIN || actor.role === Role.MENTOR;
    if (!sameOrganization || (!isOwner && !privileged)) {
      throw new ForbiddenException('errors.sandbox.executionForbidden');
    }
    return record;
  }

  private assertQuota(userId: string, organizationId: string): void {
    let userCount = 0;
    let organizationCount = 0;
    for (const record of this.executions.values()) {
      if (record.userId === userId) userCount += 1;
      if (record.organizationId === organizationId) organizationCount += 1;
    }
    const policy = this.securityConfig.policy;
    if (
      userCount >= policy.userConcurrency ||
      organizationCount >= policy.organizationConcurrency
    ) {
      throw new HttpException('errors.sandbox.concurrencyExceeded', HttpStatus.TOO_MANY_REQUESTS);
    }
  }
}
