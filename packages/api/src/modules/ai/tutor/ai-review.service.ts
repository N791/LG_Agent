/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/restrict-template-expressions */
import { Injectable, Logger, NotFoundException, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { LLMGatewayService } from '../gateway/llm-gateway.service';
import { AiReviewDTO, NotificationType, NotificationPriority } from '@lg-agent/contracts';
import type { INotificationPublisher } from '../../notifications/notification-publisher.interface';
import { NOTIFICATION_PUBLISHER } from '../../notifications/notification-publisher.interface';

@Injectable()
export class AiReviewService {
  private readonly logger = new Logger(AiReviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmGateway: LLMGatewayService,
    @Optional()
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notificationPublisher?: INotificationPublisher,
  ) {}

  async generateReview(submissionId: string): Promise<AiReviewDTO> {
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

    if (submission.aiReview) {
      return submission.aiReview as unknown as AiReviewDTO;
    }

    // Prepare content for LLM
    const logs = submission.logs ?? 'No logs available.';
    const report = submission.report
      ? JSON.stringify(submission.report, null, 2)
      : 'No report available.';

    const systemPrompt = `
You are an expert software engineering mentor evaluating a trainee's failed submission.
Your task is to analyze the execution logs and test report, identify why the code failed, and provide a structured AI Review Report.

The JSON MUST conform to the following schema structure:
{
  "summary": "String, a high-level explanation of why the code failed",
  "suggestions": ["String", "List of actionable advice to fix the approach"],
  "errors": [
    {
      "file": "String, the path of the file containing the error",
      "line": "Number, the approximate line number of the error (optional)",
      "message": "String, explanation of the specific error",
      "fix": {
        "strategy": "FULL_FILE",
        "files": [
          {
            "path": "String, the path of the file to fix",
            "content": "String, the COMPLETE updated syntactically valid code for the file"
          }
        ]
      }
    }
  ]
}

CRITICAL RULES:
1. ONLY return the valid JSON object. Do not include markdown formatting like \`\`\`json.
2. The response must be perfectly parseable by JSON.parse().
3. The "fix" MUST provide the full file content (strategy "FULL_FILE"), do not use diffs or patches. If the file is unknown, omit the fix object.
`;

    const userPrompt = `
Task Context:
${submission.task.description}

Execution Logs:
${logs.substring(0, 5000)}

Test Report:
${report.substring(0, 5000)}
`;

    try {
      this.logger.log(`Requesting AI Review for submission ${submissionId}...`);
      const llmResponse = await this.llmGateway.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        model: 'deepseek-chat',
        temperature: 0.1,
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
      throw new Error('Failed to generate AI Review');
    }
  }
}
