import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class CourseProgressService {
  constructor(private prisma: PrismaService) {}

  async getProgress(userId: string, courseIdQuery?: string) {
    // 1. Resolve courseId
    let courseId = courseIdQuery;
    if (!courseId) {
      const enrollment = await this.prisma.courseEnrollment.findFirst({
        where: { userId },
        orderBy: { lastAccessedAt: 'desc' },
      });
      if (enrollment) {
        courseId = enrollment.courseId;
      } else {
        const course = await this.prisma.course.findFirst();
        if (!course) throw new Error('errors.course.notAvailable');
        courseId = course.id;
      }
    }

    // 2. Lazy Enroll
    let enrollment = await this.prisma.courseEnrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    if (!enrollment) {
      enrollment = await this.prisma.courseEnrollment.create({
        data: { userId, courseId },
      });
    } else {
      enrollment = await this.prisma.courseEnrollment.update({
        where: { id: enrollment.id },
        data: { lastAccessedAt: new Date() },
      });
    }

    // 3. Gather stats for this specific course
    const [tasks, submissions, allSubmissionsForStats] = await Promise.all([
      this.prisma.task.findMany({ where: { courseId } }),
      this.prisma.submission.findMany({
        where: { userId, task: { courseId } },
        select: { taskId: true, status: true, score: true, aiReview: true, createdAt: true },
      }),
      this.prisma.submission.findMany({
        where: { userId, task: { courseId } },
        select: { status: true, score: true, aiReview: true, createdAt: true },
      }),
    ]);

    const totalTasks = tasks.length;
    const passedSubmissions = submissions.filter((s) => s.status === 'PASSED');
    const passedTaskIds = new Set(passedSubmissions.map((s) => s.taskId));
    const completedTasks = passedTaskIds.size;
    const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    let currentStage = 1;
    if (completedTasks > 0) {
      const completedTaskRecords = tasks.filter((t) => passedTaskIds.has(t.id));
      const maxStage = Math.max(...completedTaskRecords.map((t) => t.stage));
      currentStage = maxStage + 1;
    }

    if (enrollment.progress !== progressPercentage || enrollment.currentStage !== currentStage) {
      await this.prisma.courseEnrollment.update({
        where: { id: enrollment.id },
        data: { progress: progressPercentage, currentStage },
      });
    }

    const totalSubmissions = allSubmissionsForStats.length;
    const successRate =
      totalSubmissions > 0
        ? Math.round(
            (allSubmissionsForStats.filter((s) => s.status === 'PASSED').length /
              totalSubmissions) *
              100,
          )
        : 0;
    const aiUsage = allSubmissionsForStats.filter((s) => s.aiReview !== null).length;

    const distinctDays = new Set(
      allSubmissionsForStats.map((s) => s.createdAt.toISOString().split('T')[0]),
    );
    const activeDays = distinctDays.size;

    return {
      courseId,
      totalTasks,
      completedTasks,
      progressPercentage,
      currentStage,
      status: enrollment.status,
      estimatedCompletionHours: (totalTasks - completedTasks) * 2,
      statistics: {
        successRate,
        totalSubmissions,
        aiUsage,
        activeDays,
      },
    };
  }
}
