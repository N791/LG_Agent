import { Module } from '@nestjs/common';
import { SandboxService } from './sandbox.service';
import { DockerExecutor } from './docker.executor';
import { LocalExecutor } from './local.executor';
import { EnvDetectorService } from './env-detector.service';
import { ExecutionWorkspaceService } from './execution-workspace.service';
import { ExecutionManager } from './execution.manager';
import { SandboxController } from './sandbox.controller';
import { WorkspaceModule } from '../workspace';
import { NodeRuntimeProfile } from './node-runtime.profile';
import { IExecutor } from './interfaces/executor.interface';
import { SANDBOX_EXECUTION_TIMEOUT_MS, SANDBOX_EXECUTOR } from './sandbox.tokens';
import { ConfigService } from '@nestjs/config';
import { SandboxSecurityConfig } from './sandbox-security.config';
import { SandboxFacade } from './sandbox.facade';
import {
  GoRuntimeProfile,
  JavaRuntimeProfile,
  PythonRuntimeProfile,
  RustRuntimeProfile,
} from './language-runtime.profiles';
import { RuntimeProfileRegistry } from './runtime-profile.registry';
import { RuntimeMetricsService } from './runtime-metrics.service';

export function selectExecutor(
  docker: DockerExecutor,
  local: LocalExecutor,
  config: ConfigService,
): IExecutor {
  const configured = config.getOrThrow<string>('SANDBOX_EXECUTOR').toLowerCase();
  if (configured === 'docker') {
    return docker;
  }
  if (configured === 'local') {
    if (config.get<string>('NODE_ENV') === 'production') {
      throw new Error('LocalExecutor is forbidden in production');
    }
    return local;
  }
  throw new Error(`Unsupported SANDBOX_EXECUTOR: ${configured}`);
}

@Module({
  imports: [WorkspaceModule],
  controllers: [SandboxController],
  providers: [
    SandboxService,
    DockerExecutor,
    LocalExecutor,
    NodeRuntimeProfile,
    JavaRuntimeProfile,
    PythonRuntimeProfile,
    GoRuntimeProfile,
    RustRuntimeProfile,
    RuntimeProfileRegistry,
    RuntimeMetricsService,
    EnvDetectorService,
    ExecutionWorkspaceService,
    ExecutionManager,
    SandboxSecurityConfig,
    SandboxFacade,
    {
      provide: SANDBOX_EXECUTION_TIMEOUT_MS,
      useFactory: (config: SandboxSecurityConfig) => config.policy.executionTimeoutMs,
      inject: [SandboxSecurityConfig],
    },
    {
      provide: SANDBOX_EXECUTOR,
      useFactory: selectExecutor,
      inject: [DockerExecutor, LocalExecutor, ConfigService],
    },
  ],
  exports: [SandboxService, ExecutionManager, SandboxFacade, RuntimeProfileRegistry],
})
export class SandboxModule {}
