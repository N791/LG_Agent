import { PrismaService } from '../../common/prisma.service';
import { Task } from '@prisma/client';

export interface BadgeContext {
  userId: string;
  task: Task;
}

export interface IBadgeEvaluator {
  badgeCode: string;
  evaluate(context: BadgeContext, prisma: PrismaService): Promise<boolean>;
}

export class FirstBloodBadgeEvaluator implements IBadgeEvaluator {
  readonly badgeCode = 'FIRST_BLOOD';

  async evaluate(context: BadgeContext, prisma: PrismaService): Promise<boolean> {
    // This is called after the first task is passed, so if count is 1, they just got their first blood.
    // Wait, the task itself might have multiple PASSED submissions. Let's count distinct tasks.
    const uniquePassedTasks = await prisma.submission.findMany({
      where: { userId: context.userId, status: 'PASSED' },
      distinct: ['taskId'],
      select: { taskId: true },
    });

    return uniquePassedTasks.length === 1;
  }
}

export class CourseCompleterBadgeEvaluator implements IBadgeEvaluator {
  readonly badgeCode = 'COURSE_COMPLETER';

  async evaluate(context: BadgeContext, prisma: PrismaService): Promise<boolean> {
    // Get all mandatory tasks in the course
    const mandatoryTasks = await prisma.task.findMany({
      where: { courseId: context.task.courseId, taskType: 'MANDATORY' },
      select: { id: true },
    });

    const mandatoryTaskIds = mandatoryTasks.map(t => t.id);

    // Get all passed tasks for the user in this course
    const passedSubmissions = await prisma.submission.findMany({
      where: {
        userId: context.userId,
        status: 'PASSED',
        taskId: { in: mandatoryTaskIds },
      },
      distinct: ['taskId'],
      select: { taskId: true },
    });

    return passedSubmissions.length === mandatoryTaskIds.length && mandatoryTaskIds.length > 0;
  }
}

export class QuickLearnerBadgeEvaluator implements IBadgeEvaluator {
  readonly badgeCode = 'QUICK_LEARNER';

  async evaluate(context: BadgeContext, prisma: PrismaService): Promise<boolean> {
    // Did they pass this task on their very first submission attempt?
    const allSubmissionsForTask = await prisma.submission.findMany({
      where: { userId: context.userId, taskId: context.task.id },
      orderBy: { createdAt: 'asc' },
    });

    if (allSubmissionsForTask.length === 0) return false;
    
    // The very first submission should be PASSED
    return allSubmissionsForTask[0]?.status === 'PASSED';
  }
}
