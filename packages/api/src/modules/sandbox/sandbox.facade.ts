import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { ExecutionEventDTO, SandboxAction } from '@lg-agent/contracts';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { AuthoringWorkspaceService } from '../workspace';
import { ExecutionManager } from './execution.manager';
import { SandboxService } from './sandbox.service';

@Injectable()
export class SandboxFacade {
  constructor(
    private readonly sandbox: SandboxService,
    private readonly executions: ExecutionManager,
    private readonly workspaces: AuthoringWorkspaceService,
  ) {}

  async reserve(actor: TenantActor, taskId: string, action?: SandboxAction): Promise<string> {
    await this.workspaces.getWorkspace(taskId, actor.id);
    const executionId = randomUUID();
    this.executions.reserve(executionId, actor, taskId, action);
    return executionId;
  }

  async run(
    executionId: string,
    actor: TenantActor,
    taskId: string,
    action?: SandboxAction,
  ): Promise<AsyncGenerator<ExecutionEventDTO, void, unknown>> {
    this.executions.claim(executionId, actor, taskId, action);
    const workspace = await this.workspaces.getWorkspace(taskId, actor.id);
    const runtime = await this.workspaces.getRuntime(taskId, actor.id);
    return this.sandbox.runTask(taskId, actor.id, workspace, {
      action,
      runtime,
      executionId,
      organizationId: actor.organizationId,
    });
  }

  stop(executionId: string, actor: TenantActor): void {
    this.executions.stop(executionId, actor);
  }

  release(executionId: string): void {
    this.executions.unregister(executionId);
  }
}
