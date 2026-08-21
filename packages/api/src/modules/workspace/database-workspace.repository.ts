import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkspaceRepository } from '@lg-agent/contracts';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class DatabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspace(
    taskId: string,
    userId: string,
  ): Promise<{
    fileContents: Record<string, string>;
    entry?: string;
    metadata?: Record<string, unknown>;
  }> {
    // Attempt to load workspace from database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });
    const workspace = user
      ? await this.prisma.workspace.findFirst({
          where: {
            userId,
            taskId,
            user: { organizationId: user.organizationId },
            task: { course: { organizationId: user.organizationId } },
          },
          include: {
            files: true,
          },
        })
      : null;

    if (!workspace) {
      throw new NotFoundException({ message: 'errors.workspace.initRequired', args: { taskId } });
    }

    const fileContents: Record<string, string> = {};
    for (const file of workspace.files) {
      fileContents[file.path] = file.content;
    }

    // TODO: Determine entry point from metadata or configuration
    // For now we might hardcode or fetch from Task configuration
    return {
      fileContents,
      entry: 'index.ts',
      metadata: {
        status: workspace.status,
      },
    };
  }
}
