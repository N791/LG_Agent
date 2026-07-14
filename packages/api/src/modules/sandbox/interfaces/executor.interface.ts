import { EnvRequirement } from '../env-detector.service';
import { WorkspaceDTO, ExecutionEventDTO } from '@lg-agent/contracts';

export interface IExecutor {
  execute(
    taskId: string,
    userId: string,
    workspace: WorkspaceDTO,
    config: { testScript?: string | null; env?: EnvRequirement | null },
  ): AsyncGenerator<ExecutionEventDTO, void, unknown>;
}
