import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WorkspaceDTO, WorkspaceFileDTO, WorkspaceVersionDTO } from '@lg-agent/contracts';
import { WorkspaceInitializer } from './workspace.initializer';

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly initializer: WorkspaceInitializer,
  ) {}

  async initWorkspace(taskId: string, userId: string): Promise<WorkspaceDTO> {
    return this.initializer.initialize(taskId, userId);
  }

  async getWorkspace(taskId: string, userId: string): Promise<WorkspaceDTO> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { userId_taskId: { userId, taskId } },
      include: { files: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace for task ${taskId} not found`);
    }

    return this.mapToDTO(workspace);
  }

  async updateFiles(
    taskId: string,
    userId: string,
    files: Pick<WorkspaceFileDTO, 'path' | 'content'>[],
  ): Promise<WorkspaceDTO> {
    // Auto-save updates the Draft workspace. It does not create a new version.
    const workspace = await this.prisma.workspace.findUnique({
      where: { userId_taskId: { userId, taskId } },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace not found`);
    }

    await this.prisma.$transaction(async (prisma) => {
      for (const file of files) {
        // Upsert based on path
        const existingFile = await prisma.workspaceFile.findUnique({
          where: { workspaceId_path: { workspaceId: workspace.id, path: file.path } },
        });

        if (existingFile) {
          await prisma.workspaceFile.update({
            where: { id: existingFile.id },
            data: { content: file.content },
          });
        } else {
          await prisma.workspaceFile.create({
            data: {
              workspaceId: workspace.id,
              path: file.path,
              content: file.content,
            },
          });
        }
      }
    });

    return this.getWorkspace(taskId, userId);
  }

  async createVersion(
    taskId: string,
    userId: string,
    trigger: 'RUN' | 'SUBMIT' | 'MANUAL',
  ): Promise<WorkspaceVersionDTO> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { userId_taskId: { userId, taskId } },
      include: { files: true },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace not found`);
    }

    const currentVersionCount = await this.prisma.workspaceVersion.count({
      where: { workspaceId: workspace.id },
    });

    const snapshot = workspace.files.map((f) => ({
      path: f.path,
      content: f.content,
      language: f.language ?? undefined,
      encoding: f.encoding ?? undefined,
      readonly: f.readonly,
      hidden: f.hidden,
    }));

    const version = await this.prisma.workspaceVersion.create({
      data: {
        workspaceId: workspace.id,
        version: currentVersionCount + 1,
        trigger,
        snapshot: snapshot as unknown as Record<string, unknown>[],
      },
    });

    return {
      id: version.id,
      workspaceId: version.workspaceId,
      version: version.version,
      trigger: version.trigger,
      snapshot,
      createdAt: version.createdAt.toISOString(),
    };
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
