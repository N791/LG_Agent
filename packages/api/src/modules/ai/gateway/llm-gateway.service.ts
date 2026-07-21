import { Injectable, Logger } from '@nestjs/common';
import { LLMRequest, LLMResponse, StreamEvent } from '../interfaces/llm-provider.interface';
import { ProviderRegistry } from '../providers/provider-registry.service';
import { SensitiveDataFilter } from '../filters/sensitive-data.filter';
import { ResponseSafetyFilter } from '../filters/response-safety.filter';

import { PrismaService } from '../../../common/prisma.service';
import { CostCalculator } from '../cost/cost-calculator.service';

@Injectable()
export class LLMGatewayService {
  private readonly logger = new Logger(LLMGatewayService.name);

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly sensitiveDataFilter: SensitiveDataFilter,
    private readonly responseSafetyFilter: ResponseSafetyFilter,
    private readonly prisma: PrismaService,
    private readonly costCalculator: CostCalculator,
  ) {}

  async chat(request: LLMRequest, providerName?: string): Promise<LLMResponse> {
    // 1. Resolve Provider
    const provider = providerName
      ? this.providerRegistry.getProvider(providerName)
      : await this.providerRegistry.getFallbackProvider();

    // 2. Filter Sensitive Data in Request
    const safeMessages = await Promise.all(
      request.messages.map(async (msg) => ({
        role: msg.role,
        content: await this.sensitiveDataFilter.filter(msg.content),
      })),
    );

    const safeRequest: LLMRequest = {
      ...request,
      messages: safeMessages,
    };

    const startTime = Date.now();
    try {
      // 3. Execute via Provider
      const response = await provider.chat(safeRequest);

      // 4. Filter Response Safety
      response.content = await this.responseSafetyFilter.filterComplete(response.content);

      const latency = Date.now() - startTime;
      this.logger.log(
        `LLM Request successful. Provider: ${provider.name}, Latency: ${String(latency)}ms`,
      );

      const estimatedCost = await this.costCalculator.estimate(
        provider.name,
        response.usage.promptTokens,
        response.usage.completionTokens,
      );

      await this.prisma.llmRequestLog.create({
        data: {
          requestId: Math.random().toString(36).substring(7),
          provider: provider.name,
          model: response.model || 'unknown',
          requestType: 'chat',
          latency,
          promptTokens: response.usage.promptTokens,
          completionTokens: response.usage.completionTokens,
          totalTokens: response.usage.totalTokens,
          estimatedCost,
          status: response.finishReason || 'success',
        },
      });

      return response;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`LLM Request failed with provider ${provider.name}`, err.stack);

      // Fallback logic
      const fallbackProvider = await this.providerRegistry.getFallbackProvider();

      // If the provider that just failed is the exact same as the fallback, there is no point retrying with it.
      if (provider.name !== fallbackProvider.name) {
        this.logger.warn(`Falling back to ${fallbackProvider.name}`);
        const response = await fallbackProvider.chat(safeRequest);
        response.content = await this.responseSafetyFilter.filterComplete(response.content);
        return response;
      }

      throw error;
    }
  }

  async *stream(
    request: LLMRequest,
    providerName?: string,
  ): AsyncGenerator<StreamEvent, void, unknown> {
    const provider = providerName
      ? this.providerRegistry.getProvider(providerName)
      : await this.providerRegistry.getFallbackProvider();

    // 1. Filter Sensitive Data in Request
    const safeMessages = await Promise.all(
      request.messages.map(async (msg) => ({
        role: msg.role,
        content: await this.sensitiveDataFilter.filter(msg.content),
      })),
    );

    const safeRequest: LLMRequest = {
      ...request,
      messages: safeMessages,
    };

    const startTime = Date.now();
    let promptLength = 0;
    safeMessages.forEach((m) => {
      promptLength += m.content.length;
    });
    const fallbackPromptTokens = Math.ceil(promptLength / 4) || 1;

    let completionContent = '';
    let finalUsage = undefined;
    let usedModel = request.model;

    try {
      // 2. Stream from Provider
      const stream = provider.stream(safeRequest);

      for await (const event of stream) {
        // 3. Filter Response Chunk
        const safeChunk = await this.responseSafetyFilter.filterChunk(event.content);
        completionContent += safeChunk;

        if (event.usage) {
          finalUsage = event.usage;
        }
        if (event.model) {
          usedModel = event.model;
        }

        yield {
          content: safeChunk,
          usage: event.usage,
          model: event.model,
        };
      }

      // Log usage after stream completes
      const latency = Date.now() - startTime;
      const promptTokens = finalUsage?.promptTokens ?? fallbackPromptTokens;
      const completionTokens =
        finalUsage?.completionTokens ?? (Math.ceil(completionContent.length / 4) || 1);
      const totalTokens = finalUsage?.totalTokens ?? promptTokens + completionTokens;

      const estimatedCost = await this.costCalculator.estimate(
        provider.name,
        promptTokens,
        completionTokens,
      );

      await this.prisma.llmRequestLog.create({
        data: {
          requestId: Math.random().toString(36).substring(7),
          provider: provider.name,
          model: usedModel ?? 'unknown',
          requestType: 'stream',
          latency,
          promptTokens,
          completionTokens,
          totalTokens,
          estimatedCost,
          status: 'success',
        },
      });
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`LLM Stream failed with provider ${provider.name}`, err.stack);

      const fallbackProvider = await this.providerRegistry.getFallbackProvider();
      if (provider.name !== fallbackProvider.name) {
        this.logger.warn(`Falling back stream to ${fallbackProvider.name}`);
        const fallbackStream = fallbackProvider.stream(safeRequest);
        for await (const event of fallbackStream) {
          const safeChunk = await this.responseSafetyFilter.filterChunk(event.content);
          yield { content: safeChunk, usage: event.usage };
        }
        return;
      }
      throw error;
    }
  }

  async embed(texts: string[], providerName?: string): Promise<number[][]> {
    const provider = providerName
      ? this.providerRegistry.getProvider(providerName)
      : await this.providerRegistry.getFallbackProvider();

    // Filter sensitive data before embedding
    const safeTexts = await Promise.all(texts.map((t) => this.sensitiveDataFilter.filter(t)));

    try {
      const vectors = await provider.embed(safeTexts);
      return vectors;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Embedding Request failed with provider ${provider.name}`, err.stack);
      const fallbackProvider = await this.providerRegistry.getFallbackProvider();
      if (provider.name !== fallbackProvider.name) {
        return fallbackProvider.embed(safeTexts);
      }
      throw error;
    }
  }

  getAvailableModels(): string[] {
    return this.providerRegistry.getAllProviders().map((p) => p.name);
  }
}
