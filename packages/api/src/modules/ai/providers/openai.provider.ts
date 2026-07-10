import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ILLMProvider, LLMRequest, LLMResponse } from '../interfaces/llm-provider.interface';

@Injectable()
export class OpenAIProvider implements ILLMProvider {
  public readonly name = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private embedModel!: OpenAIEmbeddings;
  private isConfigured = false;

  constructor(private readonly configService: ConfigService) {
    this.init();
  }

  private init() {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    const timeout = this.configService.get<number>('OPENAI_TIMEOUT_MS');
    const maxRetries = this.configService.get<number>('OPENAI_MAX_RETRIES');

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not set. OpenAI Provider will be unavailable.');
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

    this.embedModel = new OpenAIEmbeddings(config);
    this.isConfigured = true;
    this.logger.log('OpenAI Provider initialized');
  }

  private ensureConfigured() {
    if (!this.isConfigured) {
      throw new Error('OpenAI Provider is not properly configured (missing API Key)');
    }
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    this.ensureConfigured();

    const messages = request.messages.map((m) =>
      m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content),
    );

    const modelName =
      request.model ?? this.configService.get<string>('OPENAI_DEFAULT_MODEL') ?? 'gpt-3.5-turbo';

    const config: {
      openAIApiKey: string;
      timeout?: number;
      maxRetries?: number;
      configuration?: { baseURL: string };
      modelName: string;
      temperature?: number;
    } = {
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY') ?? '',
      timeout: this.configService.get<number>('OPENAI_TIMEOUT_MS'),
      maxRetries: this.configService.get<number>('OPENAI_MAX_RETRIES'),
      modelName,
      temperature: request.temperature,
    };
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    if (baseURL) config.configuration = { baseURL };

    const chatInstance = new ChatOpenAI(config);

    const response = await chatInstance.invoke(messages);

    // Attempt to extract usage if available from standard OpenAI responses
    // LangChain places usage metadata in `response.response_metadata.tokenUsage`
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

  async *stream(request: LLMRequest): AsyncGenerator<string, void, unknown> {
    this.ensureConfigured();

    const messages = request.messages.map((m) =>
      m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content),
    );

    const modelName =
      request.model ?? this.configService.get<string>('OPENAI_DEFAULT_MODEL') ?? 'gpt-3.5-turbo';

    const config: {
      openAIApiKey: string;
      timeout?: number;
      maxRetries?: number;
      configuration?: { baseURL: string };
      modelName: string;
      temperature?: number;
    } = {
      openAIApiKey: this.configService.get<string>('OPENAI_API_KEY') ?? '',
      timeout: this.configService.get<number>('OPENAI_TIMEOUT_MS'),
      maxRetries: this.configService.get<number>('OPENAI_MAX_RETRIES'),
      modelName,
      temperature: request.temperature,
    };
    const baseURL = this.configService.get<string>('OPENAI_BASE_URL');
    if (baseURL) config.configuration = { baseURL };

    const chatInstance = new ChatOpenAI(config);

    const stream = await chatInstance.stream(messages);
    for await (const chunk of stream) {
      yield typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    this.ensureConfigured();
    return this.embedModel.embedDocuments(texts);
  }

  listModels(): Promise<string[]> {
    this.ensureConfigured();
    return Promise.resolve(['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo']); // Simple stub for available models
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(this.isConfigured);
  }
}
