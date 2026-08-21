import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRampUpFunnel(actor: TenantActor, courseId?: string) {
    // Determine the tasks in order of stage
    const tasks = await this.prisma.task.findMany({
      where: {
        ...(courseId ? { courseId } : {}),
        course: { organizationId: actor.organizationId },
      },
      orderBy: { stage: 'asc' },
      select: { id: true, stage: true, title: true },
    });

    if (!tasks.length) return [];

    const passed = await this.prisma.submission.groupBy({
      by: ['taskId'],
      where: {
        taskId: { in: tasks.map(({ id }) => id) },
        status: 'PASSED',
        user: { organizationId: actor.organizationId },
      },
      _count: { id: true },
    });
    const passedByTask = new Map(passed.map((entry) => [entry.taskId, entry._count.id]));
    const funnel = [];
    let previousCount = 0;

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (!task) continue;
      const passedCount = passedByTask.get(task.id) ?? 0;

      const dropOff = i === 0 ? 0 : previousCount - passedCount;
      const conversionRate =
        i === 0 || previousCount === 0 ? 100 : (passedCount / previousCount) * 100;

      funnel.push({
        stage: task.stage,
        taskName: task.title,
        passedCount,
        dropOff: dropOff > 0 ? dropOff : 0,
        conversionRate: conversionRate.toFixed(1) + '%',
      });

      previousCount = passedCount;
    }

    return funnel;
  }

  async getTopBottlenecks(actor: TenantActor, courseId?: string) {
    const taskScope = {
      ...(courseId ? { courseId } : {}),
      course: { organizationId: actor.organizationId },
    };
    // Find tasks with the highest failure rates (FAILED submissions)
    const stats = await this.prisma.submission.groupBy({
      by: ['taskId'],
      where: {
        task: taskScope,
        user: { organizationId: actor.organizationId },
      },
      _count: {
        id: true,
      },
    });

    const failedStats = await this.prisma.submission.groupBy({
      by: ['taskId'],
      where: {
        task: taskScope,
        user: { organizationId: actor.organizationId },
        status: 'FAILED',
      },
      _count: {
        id: true,
      },
    });

    const tasks = await this.prisma.task.findMany({
      where: taskScope,
      select: { id: true, title: true },
    });
    const taskMap = new Map(tasks.map((t) => [t.id, t.title]));

    const bottlenecks = stats.map((stat) => {
      const failedStat = failedStats.find((f) => f.taskId === stat.taskId);
      const failedCount = failedStat ? failedStat._count.id : 0;
      const totalCount = stat._count.id;
      const failRate = totalCount === 0 ? 0 : (failedCount / totalCount) * 100;

      return {
        taskId: stat.taskId,
        taskName: taskMap.get(stat.taskId) ?? 'Unknown',
        totalSubmissions: totalCount,
        failedSubmissions: failedCount,
        failRate: failRate.toFixed(1) + '%',
      };
    });

    // Sort by failRate descending
    return bottlenecks.sort((a, b) => parseFloat(b.failRate) - parseFloat(a.failRate)).slice(0, 10);
  }

  async getPerformanceStats(actor: TenantActor, _courseId?: string) {
    // Mock performance stats for MVP
    return {
      averageCompletionTimeDays: 14.5,
      overallPassRate: '78%',
      activeTrainees: await this.prisma.user.count({
        where: { role: 'TRAINEE', organizationId: actor.organizationId },
      }),
    };
  }
}
