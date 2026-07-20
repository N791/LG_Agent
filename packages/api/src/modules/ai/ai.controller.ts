import {
  Controller,
  Post,
  Body,
  Res,
  BadRequestException,
  Get,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import type { Response } from 'express';
import { ChatRequestDto } from './tutor/interfaces';
import { LLMResponse } from './interfaces/llm-provider.interface';
import { AiConversationService } from './conversation/ai-conversation.service';
import { ModelRegistryService } from './model-registry.service';
import { ModelInfoDTO } from '@lg-agent/contracts';
import { Ai2TaskService, GenerateTaskRequest } from './ai2task.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuickActionRegistry } from './tutor/quick-actions/quick-action.registry';

import { AiReviewService } from './tutor/ai-review.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(
    private readonly aiConversationService: AiConversationService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly ai2taskService: Ai2TaskService,
    private readonly quickActionRegistry: QuickActionRegistry,
    private readonly aiReviewService: AiReviewService,
  ) {}

  @Get('tutor/quick-actions/:action')
  async getQuickActions(@Param('action') action: string) {
    return this.quickActionRegistry.getActions(action);
  }

  @Get('tutor/review/:submissionId')
  async getAiReview(@Param('submissionId') submissionId: string) {
    return this.aiReviewService.generateReview(submissionId);
  }

  @Post('generate-task')
  async generateTask(@Body() request: GenerateTaskRequest) {
    return this.ai2taskService.generateTaskDraft(request);
  }

  @Get('models')
  async getModels(): Promise<ModelInfoDTO[]> {
    return this.modelRegistry.listModels();
  }

  @Post('tutor/chat')
  async chat(
    @Request() req: { user: { id: string; organizationId?: string } },
    @Body() request: ChatRequestDto,
    @Res() res: Response,
  ) {
    if (!request.action || !request.content) {
      throw new BadRequestException('action and content are required');
    }

    try {
      const result = await this.aiConversationService.chat({
        action: request.action,
        taskId: request.taskId,
        content: request.content,
        stream: request.stream,
        conversationId: request.conversationId,
        userId: req.user.id,
        organizationId: req.user.organizationId ?? '',
      });

      // Handle Stream
      if (request.stream) {
        const stream = result as AsyncGenerator<string, void, unknown>;
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        for await (const chunk of stream) {
          res.write(`data: ${chunk}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // Handle normal response
        const response = result as LLMResponse;
        res.json(response);
      }
    } catch (error: unknown) {
      const err = error as Error;
      if (
        err.name === 'BadRequestException' ||
        err.message.includes('safety') ||
        err.message.includes('blocked')
      ) {
        res.status(400).json({ error: err.message });
      } else if (err.name === 'NotFoundException') {
        res.status(404).json({ error: err.message });
      } else {
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
      }
    }
  }

  @Get('tutor/conversations/:taskId')
  async getConversationHistory(
    @Request() req: { user: { id: string } },
    @Param('taskId') taskId: string,
  ) {
    return this.aiConversationService.getConversationHistory(taskId, req.user.id);
  }
}
