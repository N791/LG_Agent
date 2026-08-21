import { Injectable, Logger, Optional } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { ClsService } from 'nestjs-cls';
import {
  LLMRequest,
  LLMResponse,
  LLMUsage,
  StreamEvent,
} from '../interfaces/llm-provider.interface';
import { ProviderRegistry } from '../providers/provider-registry.service';
import { SensitiveDataFilter } from '../filters/sensitive-data.filter';
import { ResponseSafetyFilter } from '../filters/response-safety.filter';
import { CostCalculator } from '../cost/cost-calculator.service';
import { AiAuditService, AiRequestAuditRecord, AiRuleHit } from '../audit/ai-audit.service';

interface FilterWithMetadata {
  content: string;
  ruleHits: { id: string; name: string; action: string }[];
}

@Injectable()
export class LLMGatewayService {
  private readonly logger = new Logger(LLMGatewayService.name);

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly sensitiveDataFilter: SensitiveDataFilter,
    private readonly responseSafetyFilter: ResponseSafetyFilter,
    private readonly costCalculator: CostCalculator,
    private readonly auditService: AiAuditService,
    @Optional() private readonly cls?: ClsService,
  ) {}

  async chat(request: LLMRequest, providerName?: string): Promise<LLMResponse> {
    const primary = providerName
      ? this.providerRegistry.getProvider(providerName)
      : await this.providerRegistry.getFallbackProvider();
    const { request: safeRequest, ruleHits } = await this.filterRequest(request);
    const requestId = randomUUID();
    const traceId = this.resolveTraceId(request);
    const startedAt = Date.now();

    try {
      const response = await primary.chat(safeRequest);
      const filtered = await this.filterResponse(response.content);
      response.content = filtered.content;
      ruleHits.push(...this.withScope(filtered.ruleHits, 'response'));
      await this.recordResponse(
        requestId,
        traceId,
        request,
        primary.name,
        response,
        'chat',
        Date.now() - startedAt,
        ruleHits,
      );
      return response;
    } catch (error: unknown) {
      this.logger.error(`LLM Request failed with provider ${primary.name}`, (error as Error).stack);
      const fallback = await this.providerRegistry.getFallbackProvider();
      if (primary.name === fallback.name) {
        await this.recordFailure(
          requestId,
          traceId,
          request,
          primary.name,
          'chat',
          startedAt,
          ruleHits,
        );
        throw error;
      }

      this.logger.warn(`Falling back to ${fallback.name}`);
      try {
        const response = await fallback.chat(safeRequest);
        const filtered = await this.filterResponse(response.content);
        response.content = filtered.content;
        ruleHits.push(...this.withScope(filtered.ruleHits, 'response'));
        await this.recordResponse(
          requestId,
          traceId,
          request,
          fallback.name,
          response,
          'chat',
          Date.now() - startedAt,
          ruleHits,
          primary.name,
        );
        return response;
      } catch (fallbackError: unknown) {
        await this.recordFailure(
          requestId,
          traceId,
          request,
          fallback.name,
          'chat',
          startedAt,
          ruleHits,
          primary.name,
        );
        throw fallbackError;
      }
    }
  }

  async *stream(
    request: LLMRequest,
    providerName?: string,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const primary = providerName
      ? this.providerRegistry.getProvider(providerName)
      : await this.providerRegistry.getFallbackProvider();
    const { request: safeRequest, ruleHits } = await this.filterRequest(request);
    const requestId = randomUUID();
    const traceId = this.resolveTraceId(request);
    const startedAt = Date.now();

    try {
      const result = yield* this.consumeStream(primary.stream(safeRequest));
      await this.recordStream(
        requestId,
        traceId,
        request,
        primary.name,
        result,
        Date.now() - startedAt,
        [...ruleHits, ...this.withScope(result.ruleHits, 'response')],
      );
    } catch (error: unknown) {
      this.logger.error(`LLM Stream failed with provider ${primary.name}`, (error as Error).stack);
      const fallback = await this.providerRegistry.getFallbackProvider();
      if (primary.name === fallback.name) {
        await this.recordFailure(
          requestId,
          traceId,
          request,
          primary.name,
          'stream',
          startedAt,
          ruleHits,
        );
        throw error;
      }

      this.logger.warn(`Falling back stream to ${fallback.name}`);
      try {
        const result = yield* this.consumeStream(fallback.stream(safeRequest));
        await this.recordStream(
          requestId,
          traceId,
          request,
          fallback.name,
          result,
          Date.now() - startedAt,
          [...ruleHits, ...this.withScope(result.ruleHits, 'response')],
          primary.name,
        );
      } catch (fallbackError: unknown) {
        await this.recordFailure(
          requestId,
          traceId,
          request,
          fallback.name,
          'stream',
          startedAt,
          ruleHits,
          primary.name,
        );
        throw fallbackError;
      }
    }
  }

  async embed(
    texts: string[],
    providerName?: string,
    audit?: LLMRequest['audit'],
  ): Promise<number[][]> {
    const primary = providerName
      ? this.providerRegistry.getProvider(providerName)
      : await this.providerRegistry.getFallbackProvider();
    const filtered = await Promise.all(texts.map((text) => this.filterSensitive(text)));
    const safeTexts = filtered.map((result) => result.content);
    const ruleHits = filtered.flatMap((result) => this.withScope(result.ruleHits, 'request'));
    const requestId = randomUUID();
    const contextRequest: LLMRequest = { messages: [], audit };
    const traceId = this.resolveTraceId(contextRequest);
    const startedAt = Date.now();

    try {
      const vectors = await primary.embed(safeTexts);
      await this.recordEmbedding(
        requestId,
        traceId,
        contextRequest,
        primary.name,
        safeTexts,
        startedAt,
        ruleHits,
      );
      return vectors;
    } catch (error: unknown) {
      this.logger.error(
        `Embedding Request failed with provider ${primary.name}`,
        (error as Error).stack,
      );
      const fallback = await this.providerRegistry.getFallbackProvider();
      if (primary.name === fallback.name) {
        await this.recordFailure(
          requestId,
          traceId,
          contextRequest,
          primary.name,
          'embed',
          startedAt,
          ruleHits,
        );
        throw error;
      }
      try {
        const vectors = await fallback.embed(safeTexts);
        await this.recordEmbedding(
          requestId,
          traceId,
          contextRequest,
          fallback.name,
          safeTexts,
          startedAt,
          ruleHits,
          primary.name,
        );
        return vectors;
      } catch (fallbackError: unknown) {
        await this.recordFailure(
          requestId,
          traceId,
          contextRequest,
          fallback.name,
          'embed',
          startedAt,
          ruleHits,
          primary.name,
        );
        throw fallbackError;
      }
    }
  }

  getAvailableModels(): string[] {
    return this.providerRegistry.getAllProviders().map((provider) => provider.name);
  }

  private async filterRequest(
    request: LLMRequest,
  ): Promise<{ request: LLMRequest; ruleHits: AiRuleHit[] }> {
    const filtered = await Promise.all(
      request.messages.map(async (message) => ({
        role: message.role,
        ...(await this.filterSensitive(message.content)),
      })),
    );
    return {
      request: {
        ...request,
        messages: filtered.map(({ role, content }) => ({ role, content })),
      },
      ruleHits: filtered.flatMap((result) => this.withScope(result.ruleHits, 'request')),
    };
  }

  private filterSensitive(content: string): Promise<FilterWithMetadata> {
    if (typeof this.sensitiveDataFilter.filterWithMetadata === 'function') {
      return this.sensitiveDataFilter.filterWithMetadata(content);
    }
    return this.sensitiveDataFilter
      .filter(content)
      .then((safeContent) => ({ content: safeContent, ruleHits: [] }));
  }

  private filterResponse(content: string): Promise<FilterWithMetadata> {
    if (typeof this.responseSafetyFilter.filterCompleteWithMetadata === 'function') {
      return this.responseSafetyFilter.filterCompleteWithMetadata(content);
    }
    return this.responseSafetyFilter
      .filterComplete(content)
      .then((safeContent) => ({ content: safeContent, ruleHits: [] }));
  }

  private async *consumeStream(stream: AsyncGenerator<StreamEvent, void, unknown>): AsyncGenerator<
    StreamEvent,
    {
      content: string;
      usage?: LLMUsage;
      model?: string;
      ruleHits: FilterWithMetadata['ruleHits'];
    },
    unknown
  > {
    let content = '';
    let usage: LLMUsage | undefined;
    let model: string | undefined;
    const ruleHits: FilterWithMetadata['ruleHits'] = [];
    for await (const event of stream) {
      const filtered =
        typeof this.responseSafetyFilter.filterChunkWithMetadata === 'function'
          ? await this.responseSafetyFilter.filterChunkWithMetadata(event.content)
          : {
              content: await this.responseSafetyFilter.filterChunk(event.content),
              ruleHits: [],
            };
      content += filtered.content;
      ruleHits.push(...filtered.ruleHits);
      usage = event.usage ?? usage;
      model = event.model ?? model;
      yield { content: filtered.content, usage: event.usage, model: event.model };
    }
    return { content, usage, model, ruleHits };
  }

  private withScope(hits: FilterWithMetadata['ruleHits'], scope: AiRuleHit['scope']): AiRuleHit[] {
    return hits.map((hit) => ({ ...hit, scope }));
  }

  private async recordResponse(
    requestId: string,
    traceId: string,
    request: LLMRequest,
    provider: string,
    response: LLMResponse,
    requestType: 'chat' | 'stream',
    latency: number,
    ruleHits: AiRuleHit[],
    fallbackFrom?: string,
  ): Promise<void> {
    const estimatedCost = await this.costCalculator.estimate(
      response.model,
      response.usage.promptTokens,
      response.usage.completionTokens,
    );
    await this.safeRecord({
      ...request.audit,
      requestId,
      traceId,
      promptHash: request.audit?.promptHash ?? this.hashPrompt(request.messages),
      provider,
      model: response.model,
      requestType,
      latency,
      ...response.usage,
      estimatedCost,
      status: response.finishReason || 'success',
      ruleHits,
      fallbackFrom,
    });
  }

  private async recordStream(
    requestId: string,
    traceId: string,
    request: LLMRequest,
    provider: string,
    result: {
      content: string;
      usage?: LLMUsage;
      model?: string;
      ruleHits: FilterWithMetadata['ruleHits'];
    },
    latency: number,
    ruleHits: AiRuleHit[],
    fallbackFrom?: string,
  ): Promise<void> {
    const promptTokens =
      result.usage?.promptTokens ??
      Math.max(
        1,
        Math.ceil(request.messages.reduce((sum, item) => sum + item.content.length, 0) / 4),
      );
    const completionTokens =
      result.usage?.completionTokens ?? Math.max(1, Math.ceil(result.content.length / 4));
    await this.recordResponse(
      requestId,
      traceId,
      request,
      provider,
      {
        content: result.content,
        provider,
        model: result.model ?? request.model ?? 'unknown',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: result.usage?.totalTokens ?? promptTokens + completionTokens,
        },
        finishReason: 'success',
      },
      'stream',
      latency,
      ruleHits,
      fallbackFrom,
    );
  }

  private async recordEmbedding(
    requestId: string,
    traceId: string,
    request: LLMRequest,
    provider: string,
    texts: string[],
    startedAt: number,
    ruleHits: AiRuleHit[],
    fallbackFrom?: string,
  ): Promise<void> {
    const promptTokens = Math.max(
      1,
      Math.ceil(texts.reduce((sum, content) => sum + content.length, 0) / 4),
    );
    await this.safeRecord({
      ...request.audit,
      requestId,
      traceId,
      promptHash: request.audit?.promptHash ?? this.hashPrompt(texts),
      provider,
      model: request.model ?? 'embedding',
      requestType: 'embed',
      latency: Date.now() - startedAt,
      promptTokens,
      completionTokens: 0,
      totalTokens: promptTokens,
      estimatedCost: 0,
      status: 'success',
      ruleHits,
      fallbackFrom,
    });
  }

  private recordFailure(
    requestId: string,
    traceId: string,
    request: LLMRequest,
    provider: string,
    requestType: AiRequestAuditRecord['requestType'],
    startedAt: number,
    ruleHits: AiRuleHit[],
    fallbackFrom?: string,
  ): Promise<void> {
    return this.safeRecord({
      ...request.audit,
      requestId,
      traceId,
      promptHash: request.audit?.promptHash ?? this.hashPrompt(request.messages),
      provider,
      model: request.model ?? 'unknown',
      requestType,
      latency: Date.now() - startedAt,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      status: 'failed',
      ruleHits,
      fallbackFrom,
    });
  }

  private async safeRecord(record: AiRequestAuditRecord): Promise<void> {
    try {
      await this.auditService.record(record);
    } catch (error: unknown) {
      this.logger.error(
        `Failed to persist AI audit record ${record.requestId}`,
        (error as Error).stack,
      );
    }
  }

  private hashPrompt(value: unknown): string {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private resolveTraceId(request: LLMRequest): string {
    return request.audit?.traceId ?? this.cls?.get<string>('traceId') ?? randomUUID();
  }
}
