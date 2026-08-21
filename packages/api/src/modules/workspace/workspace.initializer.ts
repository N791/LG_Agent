import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  resolveStarterTemplate,
  type StarterTemplateDTO,
  type WorkspaceDTO,
  type WorkspaceFileDTO,
} from '@lg-agent/contracts';
import { createHash } from 'crypto';

@Injectable()
export class WorkspaceInitializer {
  constructor(private readonly prisma: PrismaService) {}

  async initialize(
    taskId: string,
    userId: string,
    importedFiles?: WorkspaceFileDTO[],
  ): Promise<WorkspaceDTO> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) {
      throw new NotFoundException('errors.auth.userNotFound');
    }

    // 1. Check if workspace already exists
    let workspace = await this.prisma.workspace.findFirst({
      where: {
        userId,
        taskId,
        user: { organizationId: user.organizationId },
        task: { course: { organizationId: user.organizationId } },
      },
      include: {
        files: true,
      },
    });

    if (workspace) {
      return this.mapToDTO(workspace);
    }

    // 2. Load Task to get configurations
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, course: { organizationId: user.organizationId } },
    });

    if (!task) {
      throw new NotFoundException({ message: 'errors.task.notFound', args: { id: taskId } });
    }

    // 3. Canonical reads come from sandboxConfig.starterTemplate. The shared
    // adapter preserves read-only compatibility for sandboxConfig.template and envConfig.files.
    const resolvedTemplate = resolveStarterTemplate(task.sandboxConfig, task.envConfig);
    if (!importedFiles && resolvedTemplate.source === 'canonical' && resolvedTemplate.template) {
      this.assertCanonicalTemplate(resolvedTemplate.template);
    }
    const starterFiles: WorkspaceFileDTO[] = importedFiles
      ? [...importedFiles]
      : [...(resolvedTemplate.template?.files ?? [])];

    // Default basic file if none provided
    if (starterFiles.length === 0) {
      starterFiles.push({
        path: 'index.js',
        content: '// Write your code here\n',
        language: 'javascript',
      });
    }

    // 4. Create Workspace and Files in transaction
    workspace = await this.prisma.$transaction(async (prisma) => {
      const newWorkspace = await prisma.workspace.create({
        data: {
          userId,
          taskId,
          status: 'DRAFT',
          files: {
            create: starterFiles.map((f) => ({
              path: f.path,
              content: f.content,
              language: f.language,
              encoding: f.encoding,
              readonly: f.readonly ?? false,
              hidden: f.hidden ?? false,
            })),
          },
        },
        include: {
          files: true,
        },
      });
      return newWorkspace;
    });

    const dto = this.mapToDTO(workspace);
    if (resolvedTemplate.template) {
      dto.workspace.entry = resolvedTemplate.template.entry;
      dto.workspace.metadata = {
        templateVersion: resolvedTemplate.template.version,
        templateHash: resolvedTemplate.template.contentHash,
        templateSource: resolvedTemplate.source,
      };
    }
    return dto;
  }

  private mapToDTO(workspace: {
    id: string;
    taskId: string;
    userId: string;
    status: string;
    files: {
      id: string;
      path: string;
      content: string;
      language?: string | null;
      encoding?: string | null;
      readonly: boolean;
      hidden: boolean;
    }[];
  }): WorkspaceDTO {
    return {
      id: workspace.id,
      taskId: workspace.taskId,
      userId: workspace.userId,
      status: workspace.status,
      workspace: {
        files: workspace.files.map((f) => ({
          id: f.id,
          path: f.path,
          content: f.content,
          language: f.language ?? undefined,
          encoding: f.encoding ?? undefined,
          readonly: f.readonly,
          hidden: f.hidden,
        })),
      },
    };
  }

  private assertCanonicalTemplate(template: StarterTemplateDTO): void {
    if (!template.files.some((file) => file.path === template.entry)) {
      throw new BadRequestException('STARTER_TEMPLATE_ENTRY_MISSING');
    }
    for (const file of template.files) {
      if (file.sha256 && file.sha256 !== sha256(file.content)) {
        throw new BadRequestException(`STARTER_TEMPLATE_FILE_HASH_MISMATCH:${file.path}`);
      }
    }
    const aggregate = sha256(
      template.files
        .map((file) => `${file.path}\0${file.sha256 ?? sha256(file.content)}`)
        .join('\0'),
    );
    if (aggregate !== template.contentHash) {
      throw new BadRequestException('STARTER_TEMPLATE_HASH_MISMATCH');
    }
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
