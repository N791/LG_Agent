import { Inject, Injectable } from '@nestjs/common';
import { WorkspaceInitializer } from './workspace.initializer';
import {
  TEMPLATE_SOURCE,
  type GitTemplateRequest,
  type ITemplateSource,
  type TemplateManifest,
} from './template-source.interface';

@Injectable()
export class TemplateImportService {
  constructor(
    @Inject(TEMPLATE_SOURCE) private readonly source: ITemplateSource,
    private readonly initializer: WorkspaceInitializer,
  ) {}

  async importForLearner(
    taskId: string,
    userId: string,
    request: GitTemplateRequest,
  ): Promise<{ workspaceId?: string; manifest: TemplateManifest }> {
    const imported = await this.source.importTemplate(request);
    const workspace = await this.initializer.initialize(taskId, userId, imported.files);
    return { workspaceId: workspace.id, manifest: imported.manifest };
  }
}
