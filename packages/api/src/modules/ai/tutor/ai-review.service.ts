/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { LLMGatewayService } from '../gateway/llm-gateway.service';
import { AiReviewDTO, NotificationType, NotificationPriority } from '@lg-agent/contracts';
import type { INotificationPublisher } from '../../notifications/notification-publisher.interface';
import { NOTIFICATION_PUBLISHER } from '../../notifications/notification-publisher.interface';
import type { TenantActor } from '../../../common/tenant/organization-scoped.repository';
import { TenantScopeService } from '../../../common/tenant/tenant-scope.service';
import { PromptBuilderService } from '../prompt-builder.service';

@Injectable()
export class AiReviewService {
  private readonly logger = new Logger(AiReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmGateway: LLMGatewayService,
    private readonly promptBuilder: PromptBuilderService,
    @Optional()
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notificationPublisher?: INotificationPublisher,
    private readonly tenantScope: TenantScopeService = new TenantScopeService(prisma),
  ) {}

  async getAuthorizedReview(submissionId: string, actor: TenantActor): Promise<AiReviewDTO> {
    const submission = await this.prisma.submission.findFirst({
      where: {
        id: submissionId,
        ...this.tenantScope.submission(actor),
        ...(actor.role === Role.TRAINEE && { userId: actor.id }),
      },
      select: { userId: true },
    });
    if (!submission) {
      throw new NotFoundException({
        message: 'errors.ai.submissionNotFound',
        args: { id: submissionId },
      });
    }
    return this.generateReview(submissionId, actor);
  }

  async generateReview(submissionId: string, actor?: TenantActor): Promise<AiReviewDTO> {
    const submission = await this.prisma.submission.findUnique({
      where: { id: submissionId },
      include: { task: true },
    });

    if (!submission) {
      throw new NotFoundException({
        message: 'errors.ai.submissionNotFound',
        args: { id: submissionId },
      });
    }

    if (isAiReview(submission.aiReview)) {
      return submission.aiReview;
    }

    // Prepare content for LLM
    const logs = submission.logs ?? 'No logs available.';
    const report = submission.report
      ? JSON.stringify(submission.report, null, 2)
      : 'No report available.';

    const messages = await this.promptBuilder.assembleMessages('ai_review', {
      taskDescription: submission.task.description ?? '',
      logs: logs.substring(0, 5000),
      report: report.substring(0, 5000),
    });

    try {
      this.logger.log(`Requesting AI Review for submission ${submissionId}...`);
      const llmResponse = await this.llmGateway.chat({
        messages,
        model: 'deepseek-chat',
        temperature: 0.1,
        audit: actor
          ? {
              userId: actor.id,
              organizationId: actor.organizationId,
            }
          : undefined,
      });

      let jsonStr = llmResponse.content.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.substring(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }

      const reviewReport = JSON.parse(jsonStr) as AiReviewDTO;
      await this.promptBuilder.validateOutput('ai_review', reviewReport);

      await this.prisma.submission.update({
        where: { id: submissionId },
        data: { aiReview: reviewReport as unknown as any },
      });

      // Publish AI_REVIEW_READY notification
      if (this.notificationPublisher) {
        await this.notificationPublisher.publish({
          userId: submission.userId,
          type: NotificationType.AI_REVIEW_READY,
          priority: NotificationPriority.NORMAL,
          title: 'AI Review Ready',
          message: `Your AI Review for "${submission.task.title}" is ready to view.`,
          payload: { submissionId, taskId: submission.taskId, courseId: submission.task.courseId },
        });
      }

      return reviewReport;
    } catch (error) {
      this.logger.error(`Failed to generate AI review: ${(error as Error).message}`);
      throw new ServiceUnavailableException({
        message: 'AI_REVIEW_UNAVAILABLE',
        code: (error as Error).message.startsWith('AI_PROVIDER_NOT_CONFIGURED')
          ? 'AI_PROVIDER_NOT_CONFIGURED'
          : 'AI_REVIEW_GENERATION_FAILED',
      });
    }
  }
}

function isAiReview(value: unknown): value is AiReviewDTO {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const review = value as Record<string, unknown>;
  return (
    typeof review['summary'] === 'string' &&
    Array.isArray(review['suggestions']) &&
    Array.isArray(review['errors'])
  );
}
