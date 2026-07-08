import { Module } from '@nestjs/common';
import { SandboxService } from './sandbox.service';
import { LocalExecutor } from './local.executor';
import { EnvDetectorService } from './env-detector.service';
import { WorkspaceService } from './workspace.service';
import { DockerExecutor } from './docker.executor';

@Module({
  providers: [SandboxService, LocalExecutor, EnvDetectorService, WorkspaceService, DockerExecutor],
  exports: [SandboxService],
})
export class SandboxModule {}
