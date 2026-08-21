import { Inject, Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { LLMResponse, StreamEvent } from '../interfaces/llm-provider.interface';
import {
  DisclosureLevelDTO,
  RetrievalRouteDTO,
  type ChatRequestDTO,
  type ContextEnvelopeDTO,
  type ConversationDTO,
  type ConversationMessageDTO,
  type RetrievalToolResultDTO,
  type TutorResponseDTO,
  type TutorStreamDoneDTO,
} from '@lg-agent/contracts';
import { PromptAssemblyPipeline } from './prompt-assembly.pipeline';
import { LLMGatewayService } from '../gateway/llm-gateway.service';
import { TenantScopeService } from '../../../common/tenant/tenant-scope.service';
import { Prisma, Role } from '@prisma/client';
import { CONTEXT_ORCHESTRATOR, type IContextOrchestrator } from '../retrieval/interfaces';

export interface TutorStreamResult {
  stream: AsyncGenerator<string, void, unknown>;
  done: Promise<TutorStreamDoneDTO>;
}

@Injectable()
export class AiConversationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pipeline: PromptAssemblyPipeline,
    private readonly gateway: LLMGatewayService,
    private readonly tenantScope: TenantScopeService,
    @Inject(CONTEXT_ORCHESTRATOR)
    private readonly contextOrchestrator: IContextOrchestrator,
  ) {}

  async chat(
    request: ChatRequestDTO & { userId: string; organizationId: string },
  ): Promise<TutorResponseDTO | TutorStreamResult> {
    // Validate action
    const validActions = ['chat', 'code-review', 'hint', 'explain-error', 'refactor', 'follow-up'];
    if (!validActions.includes(request.action)) {
      throw new BadRequestException({
        message: 'errors.ai.unsupportedAction',
        args: { action: request.action },
      });
    }

    // Ensure conversation exists
    await this.tenantScope.assertTask(request.taskId, {
      id: request.userId,
      organizationId: request.organizationId,
      role: Role.TRAINEE,
    });
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        ...(request.conversationId && { id: request.conversationId }),
        userId: request.userId,
        taskId: request.taskId,
        organizationId: request.organizationId,
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

    const retrieval = await this.retrieveContext(request, conversation.id, historyDtos);
    const context = retrieval.result.context;
    if (!context) throw new Error('AI_RETRIEVAL_CONTEXT_MISSING');
    const messages = await this.pipeline.assemble(request, historyDtos, context);

    if (request.stream) {
      const stream = this.gateway.stream({
        messages,
        audit: {
          userId: request.userId,
          organizationId: request.organizationId,
          conversationId: conversation.id,
        },
      });
      let finish!: (value: TutorStreamDoneDTO) => void;
      const done = new Promise<TutorStreamDoneDTO>((resolve) => {
        finish = resolve;
      });
      return {
        stream: this.streamWrapper(
          stream,
          conversation.id,
          retrieval.result,
          retrieval.degraded,
          finish,
        ),
        done,
      };
    } else {
      const response = await this.gateway.chat({
        messages,
        audit: {
          userId: request.userId,
          organizationId: request.organizationId,
          conversationId: conversation.id,
        },
      });
      const tutorResponse = this.toTutorResponse(response, retrieval.result, retrieval.degraded);
      await this.prisma.conversationMessage.create({
        data: {
          conversationId: conversation.id,
          role: 'assistant',
          content: response.content,
          model: response.model,
          tokenUsage: response.usage.totalTokens,
          metadata: this.jsonMetadata({
            citations: tutorResponse.citations,
            traceSummary: tutorResponse.traceSummary,
            evidenceSupport: tutorResponse.evidenceSupport,
            degraded: tutorResponse.degraded,
          }),
        },
      });
      return tutorResponse;
    }
  }

  private async *streamWrapper(
    stream: AsyncGenerator<StreamEvent, void, unknown>,
    conversationId: string,
    retrieval: RetrievalToolResultDTO,
    degraded: boolean,
    finish: (value: TutorStreamDoneDTO) => void,
  ): AsyncGenerator<string, void, unknown> {
    let fullContent = '';
    let finalUsage = undefined;

    try {
      for await (const event of stream) {
        fullContent += event.content;

        if (event.usage) {
          finalUsage = event.usage;
        }

        yield event.content;
      }
    } finally {
      const done = this.toStreamDone(retrieval, degraded);
      // Provider/config failures must not create a fake successful assistant message.
      if (fullContent.trim()) {
        await this.prisma.conversationMessage.create({
          data: {
            conversationId,
            role: 'assistant',
            content: fullContent,
            tokenUsage: finalUsage ? finalUsage.totalTokens : Math.ceil(fullContent.length / 4),
            metadata: this.jsonMetadata({
              citations: done.citations,
              traceSummary: done.traceSummary,
              evidenceSupport: done.evidenceSupport,
              degraded,
            }),
          },
        });
      }
      finish(done);
    }
  }

  async preview(
    request: ChatRequestDTO & { userId: string; organizationId: string },
  ): Promise<RetrievalToolResultDTO> {
    await this.tenantScope.assertTask(request.taskId, {
      id: request.userId,
      organizationId: request.organizationId,
      role: Role.TRAINEE,
    });
    const retrieval = await this.retrieveContext(request, request.conversationId, []);
    return retrieval.result;
  }

  private async retrieveContext(
    request: ChatRequestDTO & { userId: string; organizationId: string },
    conversationId: string | undefined,
    history: ConversationMessageDTO[],
  ): Promise<{ result: RetrievalToolResultDTO; degraded: boolean }> {
    try {
      const result = await this.contextOrchestrator.retrieve({
        organizationId: request.organizationId,
        userId: request.userId,
        taskId: request.taskId,
        conversationId,
        query: request.content,
        tutorAction: request.action as
          'chat' | 'code-review' | 'hint' | 'explain-error' | 'refactor' | 'follow-up',
        ...(request.activeFile && {
          activeFile: {
            path: request.activeFile,
            ...(request.repositorySnapshotId && {
              repositorySnapshotId: request.repositorySnapshotId,
            }),
          },
        }),
        ...(request.selection && { selection: request.selection }),
        ...(request.submissionLog && { errorLog: request.submissionLog }),
        ...(request.taskState && { taskState: request.taskState }),
        recentConversation: history
          .slice(-8)
          .map(({ role, content }) => `${role}: ${content}`)
          .join('\n'),
        sourceVersions: [request.workspaceVersionId, request.repositorySnapshotId].filter(
          (value): value is string => Boolean(value),
        ),
        disclosureLevel:
          request.action === 'code-review' ? DisclosureLevelDTO.L2 : DisclosureLevelDTO.L1,
      });
      if (!result.context) throw new Error('Context orchestrator returned no envelope.');
      return { result, degraded: result.context.evidence.length === 0 };
    } catch {
      return { result: this.emptyRetrieval(request), degraded: true };
    }
  }

  private emptyRetrieval(
    request: ChatRequestDTO & { userId: string; organizationId: string },
  ): RetrievalToolResultDTO {
    const budget = {
      total: 4_000,
      systemPolicy: 400,
      taskState: 400,
      recentConversation: 600,
      documents: 600,
      code: 600,
      toolResults: 200,
      modelOutput: 1_200,
      usedEvidence: 0,
      truncated: false,
    };
    const trace = {
      traceId: `degraded:${String(Date.now())}`,
      organizationId: request.organizationId,
      route: RetrievalRouteDTO.MIXED,
      disclosureLevel: DisclosureLevelDTO.L0,
      evidenceCount: 0,
      totalCandidates: 0,
      durationMs: 0,
      cacheHit: false,
      shadowRead: false,
      createdAt: new Date().toISOString(),
      policyVersion: 'query-router.v1',
      routeReasons: ['retrieval-unavailable'],
      tokenBudget: budget,
      disclosureUpgrades: [],
    };
    const context: ContextEnvelopeDTO = {
      organizationId: request.organizationId,
      route: RetrievalRouteDTO.MIXED,
      policyVersion: 'query-router.v1',
      evidence: [],
      citations: [],
      budget,
      disclosureUpgrades: [],
    };
    return { evidence: [], trace, context };
  }

  private toTutorResponse(
    response: LLMResponse,
    retrieval: RetrievalToolResultDTO,
    degraded: boolean,
  ): TutorResponseDTO {
    const done = this.toStreamDone(retrieval, degraded);
    return {
      answer: response.content,
      citations: done.citations,
      traceSummary: done.traceSummary,
      evidenceSupport: done.evidenceSupport,
      degraded,
      model: response.model,
      provider: response.provider,
      usage: response.usage,
    };
  }

  private toStreamDone(retrieval: RetrievalToolResultDTO, degraded: boolean): TutorStreamDoneDTO {
    const context = retrieval.context;
    if (!context) throw new Error('AI_RETRIEVAL_CONTEXT_MISSING');
    return {
      citations: context.citations,
      traceSummary: retrieval.trace,
      tokenBudget: context.budget,
      evidenceSupport: degraded
        ? 'INSUFFICIENT'
        : context.evidence.some(({ score }) => score < 0.65)
          ? 'INFERENCE'
          : 'SUPPORTED',
      degraded,
    };
  }

  private jsonMetadata(value: object): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  async getConversationHistory(
    taskId: string,
    userId: string,
    organizationId: string,
  ): Promise<ConversationDTO | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: { taskId, userId, organizationId },
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
