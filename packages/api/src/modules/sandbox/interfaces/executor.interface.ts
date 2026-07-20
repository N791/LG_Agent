import { EnvRequirement } from '../env-detector.service';
import { WorkspaceDTO, ExecutionEventDTO, SandboxAction } from '@lg-agent/contracts';

export interface IExecutor {
  execute(
    taskId: string,
    userId: string,
    workspace: WorkspaceDTO,
    config: { testScript?: string | null; env?: EnvRequirement | null; action?: SandboxAction },
  ): AsyncGenerator<ExecutionEventDTO, void, unknown>;
}
