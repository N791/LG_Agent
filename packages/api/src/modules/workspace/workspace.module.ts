import { Module } from '@nestjs/common';
import { DatabaseWorkspaceRepository } from './database-workspace.repository';
import { AuthoringWorkspaceService } from './authoring-workspace.service';
import { WorkspaceInitializer } from './workspace.initializer';
import { WorkspaceController } from './workspace.controller';
import { PrismaModule } from '../../common/prisma.module';
import { ConfigModule } from '@nestjs/config';
import { GitTemplateSourceAdapter } from './git-template-source.adapter';
import { TEMPLATE_SOURCE } from './template-source.interface';
import { TemplateImportService } from './template-import.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [WorkspaceController],
  providers: [
    {
      provide: 'WorkspaceRepository',
      useClass: DatabaseWorkspaceRepository,
    },
    AuthoringWorkspaceService,
    WorkspaceInitializer,
    GitTemplateSourceAdapter,
    TemplateImportService,
    { provide: TEMPLATE_SOURCE, useExisting: GitTemplateSourceAdapter },
  ],
  exports: [
    'WorkspaceRepository',
    AuthoringWorkspaceService,
    WorkspaceInitializer,
    TemplateImportService,
  ],
})
export class WorkspaceModule {}
