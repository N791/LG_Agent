import { Injectable, NotFoundException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SandboxService } from '../sandbox/sandbox.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { ExecutionEventType, NotificationType, NotificationPriority } from '@lg-agent/contracts';
import { EXECUTION_EVENT_BUS } from './interfaces/execution-event-bus.interface';
import type { IExecutionEventBus } from './interfaces/execution-event-bus.interface';

import { AiReviewService } from '../ai/tutor/ai-review.service';
import type { IAIReviewPolicy } from '../ai/tutor/ai-review.policy';
import { AchievementService } from '../achievements/achievement.service';
import type { INotificationPublisher } from '../notifications/notification-publisher.interface';
import { NOTIFICATION_PUBLISHER } from '../notifications/notification-publisher.interface';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sandbox: SandboxService,
    private readonly workspaceService: WorkspaceService,
    @Inject(EXECUTION_EVENT_BUS) private readonly eventBus: IExecutionEventBus,
    @Inject('IAIReviewPolicy') private readonly aiReviewPolicy: IAIReviewPolicy,
    private readonly aiReviewService: AiReviewService,
    private readonly achievementService: AchievementService,
    @Optional() @Inject(NOTIFICATION_PUBLISHER) private readonly notificationPublisher?: INotificationPublisher,
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

  async submitTask(userId: string, taskId: string): Promise<{ submissionId: string }> {
    const submission = await this.prisma.submission.create({
      data: {
        userId,
        taskId,
        status: 'PENDING',
      },
    });

    this.runBackground(submission.id, userId, taskId).catch((err: unknown) => {
      console.error(`Background execution failed for submission ${submission.id}`, err);
    });

    return { submissionId: submission.id };
  }

  private async runBackground(submissionId: string, userId: string, taskId: string) {
    try {
      await this.prisma.submission.update({
        where: { id: submissionId },
        data: { status: 'RUNNING' },
      });
      
      const workspaceDto = await this.workspaceService.getWorkspace(taskId, userId);
      await this.workspaceService.createVersion(taskId, userId, 'SUBMIT');

      const stream = this.sandbox.runTask(taskId, userId, workspaceDto, {});
      let passed = false;
      let score = 0;
      let logs = '';
      let report: Record<string, unknown> | null = null;

      for await (const event of stream) {
        this.eventBus.publish(submissionId, event);
        
        if (event.type === ExecutionEventType.LOG) {
          const data = event.data as { text?: string };
          if (data.text) {
            logs += data.text;
          }
        }
        if (event.type === ExecutionEventType.SUCCESS || event.type === ExecutionEventType.FAILED) {
          const data = event.data as { passed?: boolean; score?: number; report?: Record<string, unknown> };
          passed = data.passed ?? false;
          score = data.score ?? 0;
          report = data.report ?? null;
        }
      }

      await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: passed ? 'PASSED' : 'FAILED',
          score,
          logs,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
          report: (report as any) ?? undefined,
        },
      });

      const finalStatus = passed ? 'PASSED' : 'FAILED';
      
      if (passed) {
        this.achievementService.checkAndAward(userId, taskId).catch((err: unknown) => {
          console.error(`Failed to process achievements for submission ${submissionId}`, err);
        });
      }

      // Publish TASK_COMPLETED or TASK_FAILED notification
      if (this.notificationPublisher) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId }, select: { title: true, courseId: true } });
        if (task) {
          await this.notificationPublisher.publish({
            userId,
            type: passed ? NotificationType.TASK_COMPLETED : NotificationType.TASK_FAILED,
            priority: NotificationPriority.NORMAL,
            title: passed ? 'Task Passed' : 'Task Failed',
            message: passed 
              ? `Your submission for "${task.title}" passed successfully!`
              : `Your submission for "${task.title}" failed. Review the logs and try again.`,
            payload: { submissionId, taskId, courseId: task.courseId },
          });
        }
      }

      if (this.aiReviewPolicy.shouldGenerateReview(finalStatus, logs, score)) {
        // Trigger async AI review generation
        this.aiReviewService.generateReview(submissionId).catch((err: unknown) => {
          console.error(`Failed to auto-generate AI review for submission ${submissionId}`, err);
        });
      }
      
    } catch (e: unknown) {
      console.error(`Execution error for submission ${submissionId}`, e);
      const errorMessage = (e as Error).message;
      
      this.eventBus.publish(submissionId, {
        type: ExecutionEventType.ERROR,
        message: errorMessage,
        timestamp: new Date().toISOString()
      });
      
      await this.prisma.submission.update({
        where: { id: submissionId },
        data: {
          status: 'ERROR',
          logs: errorMessage,
        },
      });

      if (this.aiReviewPolicy.shouldGenerateReview('ERROR', errorMessage, 0)) {
        this.aiReviewService.generateReview(submissionId).catch((err: unknown) => {
          console.error(`Failed to auto-generate AI review for submission ${submissionId}`, err);
        });
      }
    } finally {
      this.eventBus.complete(submissionId);
    }
  }

  streamSubmissionLogs(submissionId: string) {
    return this.eventBus.subscribe(submissionId);
  }
}
