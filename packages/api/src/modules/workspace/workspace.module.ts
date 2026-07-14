import { Module } from '@nestjs/common';
import { DatabaseWorkspaceRepository } from './database-workspace.repository';
import { WorkspaceService } from './workspace.service';
import { WorkspaceInitializer } from './workspace.initializer';
import { WorkspaceController } from './workspace.controller';
import { PrismaModule } from '../../common/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspaceController],
  providers: [
    {
      provide: 'WorkspaceRepository',
      useClass: DatabaseWorkspaceRepository,
    },
    WorkspaceService,
    WorkspaceInitializer,
  ],
  exports: ['WorkspaceRepository', WorkspaceService],
})
export class WorkspaceModule {}
