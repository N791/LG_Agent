import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationPriority, NotificationType, SubmissionStatus } from '@lg-agent/contracts';
import { PrismaService } from '../../../common/prisma.service';
import { AchievementService } from '../../achievements';
import { AiReviewService, type IAIReviewPolicy } from '../../ai';
import { NOTIFICATION_PUBLISHER, type INotificationPublisher } from '../../notifications';
import {
  type ISubmissionTerminalHook,
  type SubmissionTerminalContext,
} from '../interfaces/submission-terminal-hook.interface';

@Injectable()
export class AchievementTerminalHook implements ISubmissionTerminalHook {
  constructor(private readonly achievements: AchievementService) {}

  async afterTerminal(context: SubmissionTerminalContext): Promise<void> {
    if (context.status === SubmissionStatus.PASSED) {
      await this.achievements.checkAndAward(context.userId, context.taskId);
    }
  }
}

@Injectable()
export class NotificationTerminalHook implements ISubmissionTerminalHook {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly publisher?: INotificationPublisher,
  ) {}

  async afterTerminal(context: SubmissionTerminalContext): Promise<void> {
    if (!this.publisher) return;
    if (context.status === SubmissionStatus.CANCELLED) return;

    const task = await this.prisma.task.findUnique({
      where: { id: context.taskId },
      select: { title: true, courseId: true },
    });
    if (!task) return;

    const passed = context.status === SubmissionStatus.PASSED;
    await this.publisher.publish({
      userId: context.userId,
      type: passed ? NotificationType.TASK_COMPLETED : NotificationType.TASK_FAILED,
      priority: NotificationPriority.NORMAL,
      title: passed ? 'Task Passed' : 'Task Failed',
      message: passed
        ? `Your submission for "${task.title}" passed successfully!`
        : `Your submission for "${task.title}" failed. Review the logs and try again.`,
      payload: {
        submissionId: context.submissionId,
        taskId: context.taskId,
        courseId: task.courseId,
      },
    });
  }
}

@Injectable()
export class AiReviewTerminalHook implements ISubmissionTerminalHook {
  private readonly logger = new Logger(AiReviewTerminalHook.name);

  constructor(
    @Inject('IAIReviewPolicy') private readonly policy: IAIReviewPolicy,
    private readonly reviews: AiReviewService,
  ) {}

  async afterTerminal(context: SubmissionTerminalContext): Promise<void> {
    if (!this.policy.shouldGenerateReview(context.status, context.logs, context.score)) return;

    try {
      await this.reviews.generateReview(context.submissionId);
    } catch (error: unknown) {
      this.logger.error(
        `AI review hook failed for submission ${context.submissionId}: ${(error as Error).message}`,
      );
    }
  }
}
