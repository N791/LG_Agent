import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { ChatRequestDto } from '../tutor/interfaces';
import { LLMResponse } from '../interfaces/llm-provider.interface';
import { ConversationDTO, ConversationMessageDTO } from '@lg-agent/contracts';
import { PromptAssemblyPipeline } from './prompt-assembly.pipeline';
import { LLMGatewayService } from '../gateway/llm-gateway.service';

@Injectable()
export class AiConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: PromptAssemblyPipeline,
    private readonly gateway: LLMGatewayService,
  ) {}

  async chat(
    request: ChatRequestDto & { userId: string; organizationId: string },
  ): Promise<LLMResponse | AsyncGenerator<string, void, unknown>> {
    // Validate action
    const validActions = ['chat', 'code-review', 'hint', 'explain-error', 'refactor'];
    if (!validActions.includes(request.action)) {
      throw new BadRequestException(`Unsupported action: ${request.action}`);
    }

    // Ensure conversation exists
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        userId: request.userId,
        taskId: request.taskId,
      },
    });

    conversation ??= await this.prisma.conversation.create({
      data: {
        userId: request.userId,
        taskId: request.taskId,
        organizationId: request.organizationId,
        status: 'ACTIVE',
      },
    });

    // Save user message
    await this.prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: request.content,
      },
    });

    // Fetch history
    const history = await this.prisma.conversationMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });

    const historyDtos: ConversationMessageDTO[] = history.map((h) => ({
      id: h.id,
      conversationId: h.conversationId,
      content: h.content,
      role: h.role as 'user' | 'assistant' | 'system',
      model: h.model ?? undefined,
      tokenUsage: h.tokenUsage ?? undefined,
      createdAt: h.createdAt,
      metadata: (h.metadata as Record<string, unknown> | undefined) ?? undefined,
    }));

    // Assemble Prompt
    const messages = await this.pipeline.assemble(request, historyDtos, request.userId);

    if (request.stream) {
      const stream = this.gateway.stream({ messages });
      // Return a wrapper generator that captures the full output and saves it
      return this.streamWrapper(stream, conversation.id);
    } else {
      const response = await this.gateway.chat({ messages });
      // Save assistant message
      await this.prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: response.content,
          model: response.model,
          tokenUsage: response.usage.totalTokens,
        },
      });
      return response;
    }
  }

  private async *streamWrapper(
    stream: AsyncGenerator<string, void, unknown>,
    conversationId: string,
  ): AsyncGenerator<string, void, unknown> {
    let fullContent = '';
    try {
      for await (const chunk of stream) {
        fullContent += chunk;
        yield chunk;
      }
    } finally {
      // Save assistant message after stream finishes
      await this.prisma.conversationMessage.create({
        data: {
          conversationId,
          role: 'assistant',
          content: fullContent,
        },
      });
    }
  }

  async getConversationHistory(taskId: string, userId: string): Promise<ConversationDTO | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { taskId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!conversation) return null;

    return {
      id: conversation.id,
      organizationId: conversation.organizationId,
      userId: conversation.userId,
      taskId: conversation.taskId,
      status: conversation.status,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.messages.map((m) => ({
        id: m.id,
        role: m.role as 'user' | 'assistant' | 'system',
        content: m.content,
        model: m.model ?? undefined,
        tokenUsage: m.tokenUsage ?? undefined,
        createdAt: m.createdAt,
      })),
    };
  }
}
