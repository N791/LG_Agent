import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ILLMProvider, LLMRequest, LLMResponse } from '../interfaces/llm-provider.interface';

@Injectable()
export class DeepSeekProvider implements ILLMProvider {
  public readonly name = 'deepseek';
  private readonly logger = new Logger(DeepSeekProvider.name);
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    this.init();
  }

  private init() {
    const apiKey = this.configService.get<string>('DEEPSEEK_API_KEY');
    const baseURL = this.configService.get<string>('DEEPSEEK_BASE_URL');
    const timeout = this.configService.get<number>('DEEPSEEK_TIMEOUT_MS');
    const maxRetries = this.configService.get<number>('DEEPSEEK_MAX_RETRIES');

    if (!apiKey) {
      this.logger.warn('DEEPSEEK_API_KEY is not set. DeepSeek Provider will be unavailable.');
      return;
    }

    const config: {
      openAIApiKey: string;
      timeout?: number;
      maxRetries?: number;
      configuration?: { baseURL: string };
    } = {
      openAIApiKey: apiKey,
      timeout,
      maxRetries,
    };
    if (baseURL) {
      config.configuration = { baseURL };
    }

    this.isConfigured = true;
    this.logger.log('DeepSeek Provider initialized');
  }

  private ensureConfigured() {
    if (!this.isConfigured) {
      throw new Error('DeepSeek Provider is not properly configured (missing API Key)');
    }
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    this.ensureConfigured();

    const messages = request.messages.map((m) =>
      m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content),
    );

    const modelName =
      request.model ?? this.configService.get<string>('DEEPSEEK_DEFAULT_MODEL') ?? 'deepseek-chat';

    const config: {
      openAIApiKey: string;
      timeout?: number;
      maxRetries?: number;
      configuration?: { baseURL: string };
      modelName: string;
      temperature?: number;
    } = {
      openAIApiKey: this.configService.get<string>('DEEPSEEK_API_KEY') ?? '',
      timeout: this.configService.get<number>('DEEPSEEK_TIMEOUT_MS'),
      maxRetries: this.configService.get<number>('DEEPSEEK_MAX_RETRIES'),
      modelName,
      temperature: request.temperature,
    };
    const baseURL = this.configService.get<string>('DEEPSEEK_BASE_URL');
    if (baseURL) config.configuration = { baseURL };

    const chatInstance = new ChatOpenAI(config);

    const response = await chatInstance.invoke(messages);

    const responseMetadata =
      (response.response_metadata as Record<string, unknown> | undefined) ?? {};
    const tokenUsage = (responseMetadata['tokenUsage'] as Record<string, number> | undefined) ?? {};

    return {
      content:
        typeof response.content === 'string' ? response.content : JSON.stringify(response.content),
      model: modelName,
      provider: this.name,
      usage: {
        promptTokens: tokenUsage['promptTokens'] ?? 0,
        completionTokens: tokenUsage['completionTokens'] ?? 0,
        totalTokens: tokenUsage['totalTokens'] ?? 0,
      },
      finishReason:
        typeof responseMetadata['finishReason'] === 'string'
          ? responseMetadata['finishReason']
          : 'stop',
      metadata: responseMetadata,
    };
  }

  stream(request: LLMRequest): Promise<AsyncIterable<unknown>> {
    this.ensureConfigured();

    const messages = request.messages.map((m) =>
      m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content),
    );

    const modelName =
      request.model ?? this.configService.get<string>('DEEPSEEK_DEFAULT_MODEL') ?? 'deepseek-chat';

    const config: {
      openAIApiKey: string;
      timeout?: number;
      maxRetries?: number;
      configuration?: { baseURL: string };
      modelName: string;
      temperature?: number;
    } = {
      openAIApiKey: this.configService.get<string>('DEEPSEEK_API_KEY') ?? '',
      timeout: this.configService.get<number>('DEEPSEEK_TIMEOUT_MS'),
      maxRetries: this.configService.get<number>('DEEPSEEK_MAX_RETRIES'),
      modelName,
      temperature: request.temperature,
    };
    const baseURL = this.configService.get<string>('DEEPSEEK_BASE_URL');
    if (baseURL) config.configuration = { baseURL };

    const chatInstance = new ChatOpenAI(config);

    return chatInstance.stream(messages);
  }

  embed(_texts: string[]): Promise<number[][]> {
    this.ensureConfigured();
    return Promise.reject(
      new Error('DeepSeek embedding is not officially supported by this provider wrapper yet.'),
    );
  }

  listModels(): Promise<string[]> {
    this.ensureConfigured();
    return Promise.resolve(['deepseek-chat', 'deepseek-coder']);
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(this.isConfigured);
  }
}
