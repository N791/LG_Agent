import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Injectable()
export class TrainingService {
  constructor(private prisma: PrismaService) {}

  async getTimeline(actor: TenantActor, courseId: string) {
    const [tasks, submissions] = await Promise.all([
      this.prisma.task.findMany({
        where: { courseId, course: { organizationId: actor.organizationId } },
        orderBy: { stage: 'asc' },
      }),
      this.prisma.submission.findMany({
        where: {
          userId: actor.id,
          user: { organizationId: actor.organizationId },
          task: { courseId, course: { organizationId: actor.organizationId } },
        },
        select: { taskId: true, status: true },
      }),
    ]);

    const passedTaskIds = new Set(
      submissions.filter((s) => s.status === 'PASSED').map((s) => s.taskId),
    );

    // Determine current stage max
    let currentStage = 1;
    if (passedTaskIds.size > 0) {
      const completedTaskRecords = tasks.filter((t) => passedTaskIds.has(t.id));
      const maxStage = Math.max(...completedTaskRecords.map((t) => t.stage));
      currentStage = maxStage + 1;
    }

    const timeline = tasks.map((task) => {
      let status: 'LOCKED' | 'AVAILABLE' | 'PASSED' = 'LOCKED';
      if (passedTaskIds.has(task.id)) {
        status = 'PASSED';
      } else if (task.stage <= currentStage) {
        status = 'AVAILABLE';
      }
      return {
        taskId: task.id,
        title: task.title,
        stage: task.stage,
        status,
      };
    });

    return timeline;
  }

  async getRecentLearning(actor: TenantActor) {
    // Find the most recently updated workspace for this user
    const recentWorkspace = await this.prisma.workspace.findFirst({
      where: {
        userId: actor.id,
        user: { organizationId: actor.organizationId },
        task: { course: { organizationId: actor.organizationId } },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            courseId: true,
          },
        },
      },
    });

    if (!recentWorkspace) {
      return null;
    }

    return {
      workspaceId: recentWorkspace.id,
      taskId: recentWorkspace.taskId,
      taskTitle: recentWorkspace.task.title,
      courseId: recentWorkspace.task.courseId,
      lastAccessTime: recentWorkspace.updatedAt,
    };
  }
}
