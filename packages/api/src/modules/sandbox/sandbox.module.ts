import { Module, forwardRef } from '@nestjs/common';
import { SandboxService } from './sandbox.service';
import { DockerExecutor } from './docker.executor';
import { LocalExecutor } from './local.executor';
import { EnvDetectorService } from './env-detector.service';
import { WorkspaceService } from './workspace.service';
import { ExecutionManager } from './execution.manager';
import { SandboxController } from './sandbox.controller';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [forwardRef(() => WorkspaceModule)],
  controllers: [SandboxController],
  providers: [
    SandboxService,
    DockerExecutor,
    LocalExecutor,
    EnvDetectorService,
    WorkspaceService,
    ExecutionManager,
  ],
  exports: [SandboxService, ExecutionManager],
})
export class SandboxModule {}
