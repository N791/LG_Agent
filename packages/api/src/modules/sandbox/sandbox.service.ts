import { Inject, Injectable, Optional } from '@nestjs/common';
import type { IExecutor } from './interfaces/executor.interface';
import { EnvDetectorService } from './env-detector.service';
import { ExecutionEventDTO, ExecutionEventType, WorkspaceDTO } from '@lg-agent/contracts';
import { SANDBOX_EXECUTOR } from './sandbox.tokens';
import { RuntimeMetricsService } from './runtime-metrics.service';

@Injectable()
export class SandboxService {
  constructor(
    @Inject(SANDBOX_EXECUTOR) private readonly executor: IExecutor,
    private readonly envDetector: EnvDetectorService,
    @Optional() private readonly runtimeMetrics?: RuntimeMetricsService,
  ) {}

  async *runTask(
    taskId: string,
    userId: string,
    workspace: WorkspaceDTO,
    config: {
      env?: import('./env-detector.service').EnvRequirement | null;
      testScript?: string | null;
      action?: import('@lg-agent/contracts').SandboxAction;
      executionId?: string;
      organizationId?: string;
      runtime?: Partial<import('@lg-agent/contracts').RuntimeEnvironmentDTO> | null;
      queuedAtMs?: number;
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
    if (config.queuedAtMs && config.runtime?.language && config.runtime.version) {
      this.runtimeMetrics?.observeQueue(
        { language: config.runtime.language, version: config.runtime.version },
        Math.max(0, Date.now() - config.queuedAtMs) / 1000,
      );
    }
    yield* this.executor.execute(taskId, userId, workspace, config);
  }
}
