import {
  Controller,
  Post,
  Body,
  Res,
  BadRequestException,
  Get,
  HttpCode,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ChatRequestDTO,
  type CitationDTO,
  GenerateTaskRequestDTO,
  type TutorResponseDTO,
  PERMISSIONS,
} from '@lg-agent/contracts';
import {
  AiConversationService,
  type TutorStreamResult,
} from './conversation/ai-conversation.service';
import { ModelRegistryService } from './model-registry.service';
import { ModelInfoDTO } from '@lg-agent/contracts';
import { Ai2TaskService } from './ai2task.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { QuickActionRegistry } from './tutor/quick-actions/quick-action.registry';

import { AiReviewService } from './tutor/ai-review.service';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { endSse, initializeSse, writeSseEvent } from '../../common/sse';
import { RequirePermission } from '../authorization';
import { RetrievalUxService } from './retrieval/retrieval-ux.service';
import { RetrievalObservabilityService } from './retrieval/retrieval-observability.service';
import { RetrievalShadowService } from './retrieval/evaluation/retrieval-shadow.service';
import { RetrievalTraceService } from './retrieval/retrieval-trace.service';

@Controller('ai')
@UseGuards(JwtAuthGuard)
@RequirePermission(PERMISSIONS.AI_TUTOR_USE)
export class AiController {
  constructor(
    private readonly aiConversationService: AiConversationService,
    private readonly modelRegistry: ModelRegistryService,
    private readonly ai2taskService: Ai2TaskService,
    private readonly quickActionRegistry: QuickActionRegistry,
    private readonly aiReviewService: AiReviewService,
    private readonly retrievalUx: RetrievalUxService,
    private readonly retrievalObservability: RetrievalObservabilityService,
    private readonly retrievalShadow: RetrievalShadowService,
    private readonly retrievalTraces: RetrievalTraceService,
  ) {}

  @Get('tutor/quick-actions/:action')
  async getQuickActions(@Param('action') action: string) {
    return this.quickActionRegistry.getActions(action);
  }

  @Get('tutor/review/:submissionId')
  async getAiReview(
    @Param('submissionId') submissionId: string,
    @Request() req: { user: TenantActor },
  ) {
    return this.aiReviewService.getAuthorizedReview(submissionId, req.user);
  }

  @Post('generate-task')
  @RequirePermission(PERMISSIONS.AI_TASK_GENERATE)
  async generateTask(
    @Request() req: { user: TenantActor },
    @Body() request: GenerateTaskRequestDTO,
  ) {
    return this.ai2taskService.generateTaskDraft(request, req.user);
  }

  @Get('models')
  async getModels(): Promise<ModelInfoDTO[]> {
    return this.modelRegistry.listModels();
  }

  @Post('tutor/chat')
  @HttpCode(200)
  async chat(
    @Request() req: { user: TenantActor },
    @Body() request: ChatRequestDTO,
    @Res() res: Response,
  ) {
    if (!request.action || !request.content) {
      throw new BadRequestException('errors.ai.actionRequired');
    }

    const result = await this.aiConversationService.chat({
      action: request.action,
      taskId: request.taskId,
      content: request.content,
      stream: request.stream,
      conversationId: request.conversationId,
      activeFile: request.activeFile,
      activeFileContent: request.activeFileContent,
      repositorySnapshotId: request.repositorySnapshotId,
      workspaceVersionId: request.workspaceVersionId,
      submissionLog: request.submissionLog,
      taskState: request.taskState,
      selection: request.selection,
      userId: req.user.id,
      organizationId: req.user.organizationId,
    });

    if (request.stream) {
      const streaming = result as TutorStreamResult;
      initializeSse(res);
      try {
        for await (const chunk of streaming.stream) {
          writeSseEvent(res, { type: 'CHUNK', data: chunk });
        }
        endSse(res, await streaming.done);
      } catch (error: unknown) {
        const providerMissing = (error as Error).message.startsWith('AI_PROVIDER_NOT_CONFIGURED');
        writeSseEvent(res, {
          type: 'ERROR',
          message: providerMissing ? 'AI_PROVIDER_NOT_CONFIGURED' : 'AI_TUTOR_STREAM_FAILED',
          data: {
            code: providerMissing ? 'AI_PROVIDER_NOT_CONFIGURED' : 'AI_TUTOR_STREAM_FAILED',
            recovery: providerMissing
              ? 'Configure a production LLM provider. Mock responses are disabled outside tests.'
              : 'Retry the request or open Retrieval Preview to inspect index readiness.',
          },
        });
        endSse(res);
      }
      return;
    }

    const response = result as TutorResponseDTO;
    res.json({ code: 200, message: 'success', data: response });
  }

  @Post('retrieval/preview')
  @RequirePermission(PERMISSIONS.AI_RETRIEVAL_READ)
  async previewRetrieval(@Request() req: { user: TenantActor }, @Body() request: ChatRequestDTO) {
    const scopedRequest = Object.assign(new ChatRequestDTO(), request, {
      userId: req.user.id,
      organizationId: req.user.organizationId,
    });
    const result = await this.aiConversationService.preview(scopedRequest);
    return { context: result.context, traceSummary: result.trace };
  }

  @Post('retrieval/citations/open')
  async openCitation(@Request() req: { user: TenantActor }, @Body() citation: CitationDTO) {
    return this.retrievalUx.openCitation(citation, req.user);
  }

  @Get('retrieval/indexes')
  @RequirePermission(PERMISSIONS.AI_RETRIEVAL_READ)
  async listRetrievalIndexes(@Request() req: { user: TenantActor }) {
    return this.retrievalUx.listIndexes(req.user);
  }

  @Get('retrieval/health')
  @RequirePermission(PERMISSIONS.AI_RETRIEVAL_READ)
  retrievalHealth() {
    return this.retrievalObservability.snapshots();
  }

  @Get('retrieval/shadow-comparisons')
  @RequirePermission(PERMISSIONS.AI_RETRIEVAL_READ)
  shadowComparisons(@Request() req: { user: TenantActor }) {
    return this.retrievalShadow.list(req.user.organizationId);
  }

  @Get('retrieval/traces/:traceId')
  @RequirePermission(PERMISSIONS.AI_RETRIEVAL_READ)
  retrievalTrace(@Request() req: { user: TenantActor }, @Param('traceId') traceId: string) {
    return this.retrievalTraces.get(traceId, req.user.organizationId);
  }

  @Post('retrieval/indexes/:kind/:id/activate')
  @RequirePermission(PERMISSIONS.AI_RETRIEVAL_MANAGE)
  async activateRetrievalIndex(
    @Request() req: { user: TenantActor },
    @Param('kind') rawKind: string,
    @Param('id') id: string,
  ) {
    const kind = this.parseRetrievalIndexKind(rawKind);
    await this.retrievalUx.activateIndex(kind, id, req.user);
    return { activated: true };
  }

  @Post('retrieval/indexes/:kind/:id/retry')
  @RequirePermission(PERMISSIONS.AI_RETRIEVAL_MANAGE)
  async retryRetrievalIndex(
    @Request() req: { user: TenantActor },
    @Param('kind') rawKind: string,
    @Param('id') id: string,
  ) {
    const kind = this.parseRetrievalIndexKind(rawKind);
    await this.retrievalUx.retryIndex(kind, id, req.user);
    return {
      queued: true,
      code: 'RETRIEVAL_INDEX_RETRY_QUEUED',
      recovery: 'Refresh index status to follow the rebuild.',
    };
  }

  private parseRetrievalIndexKind(rawKind: string): 'DOCUMENT' | 'CODE' {
    if (rawKind === 'DOCUMENT' || rawKind === 'CODE') return rawKind;
    throw new BadRequestException('RETRIEVAL_INDEX_KIND_INVALID');
  }

  @Get('tutor/conversations/:taskId')
  async getConversationHistory(
    @Request() req: { user: TenantActor },
    @Param('taskId') taskId: string,
  ) {
    return this.aiConversationService.getConversationHistory(
      taskId,
      req.user.id,
      req.user.organizationId,
    );
  }
}
