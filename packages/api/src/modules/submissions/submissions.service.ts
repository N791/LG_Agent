import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { ExecutionEventDTO, ExecutionEventType } from '@lg-agent/contracts';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sandbox: SandboxService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async findAll(query: { userId?: string; courseId?: string; taskId?: string }) {
    const { userId, courseId, taskId } = query;
    return this.prisma.submission.findMany({
      where: {
        ...(userId && { userId }),
        ...(taskId && { taskId }),
        ...(courseId && { task: { courseId } }),
      },
      include: {
        user: { select: { id: true, username: true } },
        task: { select: { id: true, title: true, courseId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const submission = await this.prisma.submission.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, username: true } },
        task: { select: { id: true, title: true } },
      },
    });

    if (!submission) {
      throw new NotFoundException(`Submission ${id} not found`);
    }

    return submission;
  }

  async *runAndStream(
    userId: string,
    taskId: string,
  ): AsyncGenerator<ExecutionEventDTO, void, unknown> {
    // 1. Fetch workspace
    const workspaceDto = await this.workspaceService.getWorkspace(taskId, userId);

    // 2. Create version snapshot for RUN
    await this.workspaceService.createVersion(taskId, userId, 'RUN');

    const stream = this.sandbox.runTask(taskId, userId, workspaceDto, {});
    let passed = false;
    let score = 0;

    for await (const event of stream) {
      if (event.type === ExecutionEventType.SUCCESS || event.type === ExecutionEventType.FAILED) {
        const data = event.data as { passed?: boolean; score?: number } | undefined;
        passed = data?.passed ?? false;
        score = data?.score ?? 0;
      }
      yield event;
    }

    // Save to DB after execution completes
    await this.prisma.submission.create({
      data: {
        userId,
        taskId,
        status: passed ? 'PASSED' : 'FAILED',
        score,
      },
    });
  }
}
