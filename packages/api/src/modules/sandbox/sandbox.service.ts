import { Injectable } from '@nestjs/common';
import { IExecutor, ExecutionResult } from './interfaces/executor.interface';
import { DockerExecutor } from './docker.executor';
import { EnvDetectorService } from './env-detector.service';

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

  async runTask(
    taskId: string,
    userId: string,
    code: string,
    config: { env?: import('./env-detector.service').EnvRequirement; testScript?: string },
  ): Promise<ExecutionResult> {
    // Phase 1: Environment Detection
    const envCheck = await this.envDetector.checkEnvironment(config.env ?? null);
    if (!envCheck.passed) {
      return {
        passed: false,
        score: 0,
        logs: `[Environment Verification Failed]\n${envCheck.message ?? 'Unknown error'}`,
        report: { error: 'Environment check failed' },
      };
    }

    // Phase 2: Execution
    return this.executor.execute(taskId, userId, code, config);
  }
}
