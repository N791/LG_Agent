import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WorkspaceDTO, WorkspaceFileDTO } from '@lg-agent/contracts';

@Injectable()
export class WorkspaceInitializer {
  constructor(private readonly prisma: PrismaService) {}

  async initialize(taskId: string, userId: string): Promise<WorkspaceDTO> {
    // 1. Check if workspace already exists
    let workspace = await this.prisma.workspace.findUnique({
      where: {
        userId_taskId: {
          userId,
          taskId,
        },
      },
      include: {
        files: true,
      },
    });

    if (workspace) {
      return this.mapToDTO(workspace);
    }

    // 2. Load Task to get configurations
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new NotFoundException({ message: 'errors.task.notFound', args: { id: taskId } });
    }

    // 3. Extract Starter Template from sandboxConfig or envConfig
    // Assuming envConfig has { files: [{ path, content, hidden, readonly, ... }] }
    const envConfig = (task.envConfig as { files?: WorkspaceFileDTO[] } | null) ?? {};
    const starterFiles: WorkspaceFileDTO[] = envConfig.files ?? [];

    // Default basic file if none provided
    if (starterFiles.length === 0) {
      starterFiles.push({
        path: 'index.ts',
        content: '// Write your code here\n',
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

    return this.mapToDTO(workspace);
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
}
