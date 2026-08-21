import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Injectable()
export class StatisticsService {
  // logger removed

  constructor(private readonly prisma: PrismaService) {}

  async getOverview(actor: TenantActor) {
    const [userCount, courseCount, taskCount, submissionCount, passedCount] = await Promise.all([
      this.prisma.user.count({ where: { organizationId: actor.organizationId } }),
      this.prisma.course.count({ where: { organizationId: actor.organizationId } }),
      this.prisma.task.count({
        where: { course: { organizationId: actor.organizationId } },
      }),
      this.prisma.submission.count({
        where: { task: { course: { organizationId: actor.organizationId } } },
      }),
      this.prisma.submission.count({
        where: {
          status: 'PASSED',
          task: { course: { organizationId: actor.organizationId } },
        },
      }),
    ]);

    const passRate = submissionCount > 0 ? (passedCount / submissionCount) * 100 : 0;

    return {
      totalUsers: userCount,
      totalCourses: courseCount,
      totalTasks: taskCount,
      totalSubmissions: submissionCount,
      overallPassRate: parseFloat(passRate.toFixed(2)),
    };
  }

  async getLearningTrends(actor: TenantActor) {
    // For MVP, aggregate in memory or simple grouped query
    // Since prisma doesn't support grouping by date easily across all DBs, we'll do raw query or fetch and group in memory if small
    // Using a simpler approach for MVP:
    const submissions = await this.prisma.submission.findMany({
      where: { task: { course: { organizationId: actor.organizationId } } },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const trends = new Map<string, { date: string; passed: number; failed: number }>();

    for (const sub of submissions) {
      const date = sub.createdAt.toISOString().split('T')[0];
      if (!date) continue;

      let entry = trends.get(date);
      if (!entry) {
        entry = { date, passed: 0, failed: 0 };
        trends.set(date, entry);
      }

      if (sub.status === 'PASSED') {
        entry.passed++;
      } else {
        entry.failed++;
      }
    }

    return Array.from(trends.values());
  }

  async getBlockers(actor: TenantActor) {
    const tasks = await this.prisma.task.findMany({
      where: { course: { organizationId: actor.organizationId } },
      include: {
        submissions: {
          select: { status: true },
        },
      },
    });

    const blockers = tasks.map((task) => {
      const total = task.submissions.length;
      const failed = task.submissions.filter((s) => s.status !== 'PASSED').length;
      const failureRate = total > 0 ? (failed / total) * 100 : 0;
      return {
        taskId: task.id,
        taskTitle: task.title,
        totalAttempts: total,
        failedAttempts: failed,
        failureRate: parseFloat(failureRate.toFixed(2)),
      };
    });

    // Sort by most failures
    return blockers.sort((a, b) => b.failedAttempts - a.failedAttempts).slice(0, 10);
  }

  async getAiUsage(actor: TenantActor) {
    const logs = await this.prisma.llmRequestLog.groupBy({
      by: ['model'],
      where: { organizationId: actor.organizationId },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        estimatedCost: true,
      },
      _count: {
        id: true,
      },
    });

    return logs.map((log) => ({
      model: log.model,
      totalRequests: log._count.id,
      promptTokens: log._sum.promptTokens ?? 0,
      completionTokens: log._sum.completionTokens ?? 0,
      totalTokens: log._sum.totalTokens ?? 0,
      totalCost: log._sum.estimatedCost ?? 0,
    }));
  }

  async getAiAudit(actor: TenantActor) {
    const audits = await this.prisma.llmAuditLog.groupBy({
      by: ['message'],
      where: {
        metadata: {
          path: ['organizationId'],
          equals: actor.organizationId,
        },
      },
      _count: {
        id: true,
      },
    });

    return audits
      .map((a) => ({
        rule: a.message,
        triggers: a._count.id,
      }))
      .sort((a, b) => b.triggers - a.triggers);
  }
}
