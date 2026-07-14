import { Injectable } from '@nestjs/common';
import { IExecutor } from './interfaces/executor.interface';
import { DockerExecutor } from './docker.executor';
import { EnvDetectorService } from './env-detector.service';
import { ExecutionEventDTO, ExecutionEventType, WorkspaceDTO } from '@lg-agent/contracts';

@Injectable()
export class SandboxService {
  private executor: IExecutor;

  constructor(
    private dockerExecutor: DockerExecutor,
    private envDetector: EnvDetectorService,
  ) {
    // Inject DockerExecutor as the default implementation for Epic 12
    this.executor = this.dockerExecutor;
  }

  async *runTask(
    taskId: string,
    userId: string,
    workspace: WorkspaceDTO,
    config: {
      env?: import('./env-detector.service').EnvRequirement | null;
      testScript?: string | null;
    },
  ): AsyncGenerator<ExecutionEventDTO, void, unknown> {
    // Phase 1: Environment Detection
    const envCheck = await this.envDetector.checkEnvironment(config.env ?? null);
    if (!envCheck.passed) {
      yield {
        type: ExecutionEventType.ERROR,
        message: `[Environment Verification Failed]\n${envCheck.message ?? 'Unknown error'}`,
        timestamp: new Date().toISOString(),
      };
      yield {
        type: ExecutionEventType.FAILED,
        data: { passed: false, score: 0, report: { error: 'Environment check failed' } },
        timestamp: new Date().toISOString(),
      };
      yield {
        type: ExecutionEventType.COMPLETE,
        timestamp: new Date().toISOString(),
      };
      return;
    }

    // Phase 2: Execution
    yield* this.executor.execute(taskId, userId, workspace, config);
  }
}
