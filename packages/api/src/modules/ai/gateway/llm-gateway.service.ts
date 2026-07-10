import { Injectable, Logger } from '@nestjs/common';
import { LLMRequest, LLMResponse } from '../interfaces/llm-provider.interface';
import { ProviderRegistry } from '../providers/provider-registry.service';
import { SensitiveDataFilter } from '../filters/sensitive-data.filter';
import { ResponseSafetyFilter } from '../filters/response-safety.filter';

@Injectable()
export class LLMGatewayService {
  private readonly logger = new Logger(LLMGatewayService.name);

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly sensitiveDataFilter: SensitiveDataFilter,
    private readonly responseSafetyFilter: ResponseSafetyFilter,
    // Database PrismaService would be injected here for LlmRequestLog and LlmAuditLog
  ) {}

  async chat(request: LLMRequest, providerName?: string): Promise<LLMResponse> {
    // 1. Resolve Provider
    const provider = providerName
      ? this.providerRegistry.getProvider(providerName)
      : this.providerRegistry.getFallbackProvider();

    // 2. Filter Sensitive Data in Request
    const safeMessages = request.messages.map((msg) => ({
      role: msg.role,
      content: this.sensitiveDataFilter.filter(msg.content),
    }));

    const safeRequest: LLMRequest = {
      ...request,
      messages: safeMessages,
    };

    const startTime = Date.now();
    try {
      // 3. Execute via Provider
      const response = await provider.chat(safeRequest);

      // 4. Filter Response Safety
      response.content = this.responseSafetyFilter.filter(response.content);

      const latency = Date.now() - startTime;
      this.logger.log(
        `LLM Request successful. Provider: ${provider.name}, Latency: ${String(latency)}ms`,
      );

      // TODO: Log to LlmRequestLog via Prisma here

      return response;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`LLM Request failed with provider ${provider.name}`, err.stack);

      // Fallback logic
      const fallbackProvider = this.providerRegistry.getFallbackProvider();

      // If the provider that just failed is the exact same as the fallback, there is no point retrying with it.
      if (provider.name !== fallbackProvider.name) {
        this.logger.warn(`Falling back to ${fallbackProvider.name}`);
        const response = await fallbackProvider.chat(safeRequest);
        response.content = this.responseSafetyFilter.filter(response.content);
        return response;
      }

      throw error;
    }
  }

  async embed(texts: string[], providerName?: string): Promise<number[][]> {
    const provider = providerName
      ? this.providerRegistry.getProvider(providerName)
      : this.providerRegistry.getFallbackProvider();

    // Filter sensitive data before embedding
    const safeTexts = texts.map((t) => this.sensitiveDataFilter.filter(t));

    try {
      const vectors = await provider.embed(safeTexts);
      return vectors;
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`Embedding Request failed with provider ${provider.name}`, err.stack);
      const fallbackProvider = this.providerRegistry.getFallbackProvider();
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
