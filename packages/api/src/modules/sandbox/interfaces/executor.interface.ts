import { EnvRequirement } from '../env-detector.service';
import {
  WorkspaceDTO,
  ExecutionEventDTO,
  SandboxAction,
  RuntimeEnvironmentDTO,
} from '@lg-agent/contracts';

export interface IExecutor {
  execute(
    taskId: string,
    userId: string,
    workspace: WorkspaceDTO,
    config: {
      testScript?: string | null;
      env?: EnvRequirement | null;
      action?: SandboxAction;
      executionId?: string;
      organizationId?: string;
      runtime?: Partial<RuntimeEnvironmentDTO> | null;
      queuedAtMs?: number;
    },
  ): AsyncGenerator<ExecutionEventDTO, void, unknown>;
}
