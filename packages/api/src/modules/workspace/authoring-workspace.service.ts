import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { WorkspaceDTO, WorkspaceFileDTO, WorkspaceVersionDTO } from '@lg-agent/contracts';
import type { RuntimeEnvironmentDTO } from '@lg-agent/contracts';
import { WorkspaceInitializer } from './workspace.initializer';

@Injectable()
export class AuthoringWorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly initializer: WorkspaceInitializer,
  ) {}

  async initWorkspace(taskId: string, userId: string): Promise<WorkspaceDTO> {
    return this.initializer.initialize(taskId, userId);
  }

  async getWorkspace(taskId: string, userId: string): Promise<WorkspaceDTO> {
    const workspace = await this.prisma.workspace.findFirst({
      where: await this.scopedWhere(taskId, userId),
      include: { files: true },
    });

    if (!workspace) {
      throw new NotFoundException({ message: 'errors.workspace.notFound', args: { taskId } });
    }

    return this.mapToDTO(workspace);
  }

  async getRuntime(taskId: string, userId: string): Promise<Partial<RuntimeEnvironmentDTO> | null> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        course: {
          organization: {
            users: { some: { id: userId } },
          },
        },
      },
      select: { envConfig: true },
    });
    if (!task) {
      throw new NotFoundException({ message: 'errors.task.notFound', args: { id: taskId } });
    }
    return (task.envConfig as { runtime?: Partial<RuntimeEnvironmentDTO> } | null)?.runtime ?? null;
  }

  async updateFiles(
    taskId: string,
    userId: string,
    files: Pick<WorkspaceFileDTO, 'path' | 'content'>[],
  ): Promise<WorkspaceDTO> {
    // Auto-save updates the Draft workspace. It does not create a new version.
    const workspace = await this.prisma.workspace.findFirst({
      where: await this.scopedWhere(taskId, userId),
    });

    if (!workspace) {
      throw new NotFoundException('errors.workspace.workspaceNotFound');
    }

    await this.prisma.$transaction(async (prisma) => {
      for (const file of files) {
        // Upsert based on path
        const existingFile = await prisma.workspaceFile.findUnique({
          where: { workspaceId_path: { workspaceId: workspace.id, path: file.path } },
        });

        if (existingFile) {
          if (existingFile.readonly) {
            // Ignore updates to readonly files, or throw. We will ignore to prevent breaking auto-save
            continue;
          }
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

  async deleteFile(taskId: string, userId: string, path: string): Promise<WorkspaceDTO> {
    const workspace = await this.prisma.workspace.findFirst({
      where: await this.scopedWhere(taskId, userId),
    });

    if (!workspace) {
      throw new NotFoundException('errors.workspace.workspaceNotFound');
    }

    const existingFile = await this.prisma.workspaceFile.findUnique({
      where: { workspaceId_path: { workspaceId: workspace.id, path } },
    });

    if (!existingFile) {
      throw new NotFoundException({ message: 'errors.workspace.fileNotFound', args: { path } });
    }

    if (existingFile.readonly || existingFile.locked) {
      throw new BadRequestException({ message: 'errors.workspace.deleteReadonly', args: { path } });
    }

    await this.prisma.workspaceFile.delete({
      where: { id: existingFile.id },
    });

    return this.getWorkspace(taskId, userId);
  }

  async createVersion(
    taskId: string,
    userId: string,
    trigger: 'RUN' | 'SUBMIT' | 'MANUAL',
  ): Promise<WorkspaceVersionDTO> {
    const workspace = await this.prisma.workspace.findFirst({
      where: await this.scopedWhere(taskId, userId),
      include: { files: true },
    });

    if (!workspace) {
      throw new NotFoundException({ message: 'errors.workspace.notFound', args: { taskId } });
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
      locked: f.locked,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      visibility: f.visibility as any,
    }));

    const version = await this.prisma.workspaceVersion.create({
      data: {
        workspaceId: workspace.id,
        version: currentVersionCount + 1,
        trigger,
        snapshot,
      },
    });

    return {
      id: version.id,
      workspaceId: version.workspaceId,
      version: version.version,
      trigger: version.trigger,
      snapshot: snapshot, // Cast to any to bypass strict type check for now since schema has Json
      createdAt: version.createdAt.toISOString(),
    };
  }

  async getVersions(taskId: string, userId: string): Promise<WorkspaceVersionDTO[]> {
    const workspace = await this.prisma.workspace.findFirst({
      where: await this.scopedWhere(taskId, userId),
    });

    if (!workspace) {
      throw new NotFoundException({ message: 'errors.workspace.notFound', args: { taskId } });
    }

    const versions = await this.prisma.workspaceVersion.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { version: 'desc' },
    });

    return versions.map((v) => ({
      id: v.id,
      workspaceId: v.workspaceId,
      version: v.version,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      trigger: v.trigger as any,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
      snapshot: v.snapshot as any,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async restoreVersion(taskId: string, userId: string, versionId: string): Promise<WorkspaceDTO> {
    const workspace = await this.prisma.workspace.findFirst({
      where: await this.scopedWhere(taskId, userId),
      include: { files: true, versions: true },
    });

    if (!workspace) {
      throw new NotFoundException({ message: 'errors.workspace.notFound', args: { taskId } });
    }

    const version = workspace.versions.find((v) => v.id === versionId);
    if (!version) {
      throw new NotFoundException({
        message: 'errors.workspace.versionNotFound',
        args: { versionId },
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshotFiles = version.snapshot as any as Pick<WorkspaceFileDTO, 'path' | 'content'>[];

    return await this.updateFiles(taskId, userId, snapshotFiles);
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
      locked: boolean;
      visibility?: string | null;
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
          locked: f.locked,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
          visibility: f.visibility as any,
        })),
      },
    };
  }

  private async scopedWhere(taskId: string, userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    if (!user) throw new NotFoundException('errors.auth.userNotFound');
    return {
      userId,
      taskId,
      user: { organizationId: user.organizationId },
      task: { course: { organizationId: user.organizationId } },
    };
  }
}
