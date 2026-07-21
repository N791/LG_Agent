import { Injectable } from '@nestjs/common';
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import {
  ILLMProvider,
  LLMRequest,
  LLMResponse,
  StreamEvent,
} from '../interfaces/llm-provider.interface';
import { ModelInfoDTO } from '@lg-agent/contracts';
import { AiConfigService } from '../ai-config.service';

@Injectable()
export class OpenAIProvider implements ILLMProvider {
  public readonly name = 'openai';

  constructor(private readonly config: AiConfigService) {}

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const aiConfig = await this.config.getOpenAIConfig();

    if (!aiConfig.apiKey) {
      throw new Error('OpenAI Provider is not properly configured (missing API Key)');
    }

    const messages = request.messages.map((m) =>
      m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content),
    );

    const modelName = request.model ?? aiConfig.defaultModel;

    const config: {
      openAIApiKey: string;
      timeout?: number;
      maxRetries?: number;
      configuration?: { baseURL: string };
      modelName: string;
      temperature?: number;
    } = {
      openAIApiKey: aiConfig.apiKey,
      timeout: aiConfig.timeoutMs,
      maxRetries: aiConfig.maxRetries,
      modelName,
      temperature: request.temperature,
    };

    if (aiConfig.baseURL) config.configuration = { baseURL: aiConfig.baseURL };

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

  async *stream(request: LLMRequest): AsyncGenerator<StreamEvent, void, unknown> {
    const aiConfig = await this.config.getOpenAIConfig();

    if (!aiConfig.apiKey) {
      throw new Error('OpenAI Provider is not properly configured (missing API Key)');
    }

    const messages = request.messages.map((m) =>
      m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content),
    );

    const modelName = request.model ?? aiConfig.defaultModel;

    const config: {
      openAIApiKey: string;
      timeout?: number;
      maxRetries?: number;
      configuration?: { baseURL: string };
      modelName: string;
      temperature?: number;
    } = {
      openAIApiKey: aiConfig.apiKey,
      timeout: aiConfig.timeoutMs,
      maxRetries: aiConfig.maxRetries,
      modelName,
      temperature: request.temperature,
    };

    if (aiConfig.baseURL) config.configuration = { baseURL: aiConfig.baseURL };

    const chatInstance = new ChatOpenAI(config);

    const stream = await chatInstance.stream(messages);
    for await (const chunk of stream) {
      const content =
        typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);

      // Attempt to extract usage if present in chunk metadata (varies by langchain version/config)
      const chunkMetadata = (chunk.response_metadata as Record<string, unknown> | undefined) ?? {};
      const tokenUsage = chunkMetadata['tokenUsage'] as Record<string, number> | undefined;

      if (tokenUsage && typeof tokenUsage['totalTokens'] === 'number') {
        yield {
          content,
          usage: {
            promptTokens: tokenUsage['promptTokens'] ?? 0,
            completionTokens: tokenUsage['completionTokens'] ?? 0,
            totalTokens: tokenUsage['totalTokens'] ?? 0,
          },
          model: modelName,
        };
      } else {
        yield { content, model: modelName };
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const aiConfig = await this.config.getOpenAIConfig();
    if (!aiConfig.apiKey) {
      throw new Error('OpenAI Provider is not properly configured (missing API Key)');
    }

    const config: {
      openAIApiKey: string;
      timeout?: number;
      maxRetries?: number;
      configuration?: { baseURL: string };
    } = {
      openAIApiKey: aiConfig.apiKey,
      timeout: aiConfig.timeoutMs,
      maxRetries: aiConfig.maxRetries,
    };
    if (aiConfig.baseURL) config.configuration = { baseURL: aiConfig.baseURL };

    const embedModel = new OpenAIEmbeddings(config);
    return embedModel.embedDocuments(texts);
  }

  listModels(): Promise<ModelInfoDTO[]> {
    return Promise.resolve([
      {
        id: 'openai:gpt-4o',
        provider: 'openai',
        model: 'gpt-4o',
        name: 'GPT-4o',
        enabled: true,
        default: true,
        capabilities: ['chat', 'stream', 'vision', 'toolCalling'],
        status: 'active',
      },
      {
        id: 'openai:gpt-4-turbo',
        provider: 'openai',
        model: 'gpt-4-turbo',
        name: 'GPT-4 Turbo',
        enabled: true,
        default: false,
        capabilities: ['chat', 'stream', 'vision', 'toolCalling'],
        status: 'active',
      },
      {
        id: 'openai:gpt-3.5-turbo',
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        name: 'GPT-3.5 Turbo',
        enabled: true,
        default: false,
        capabilities: ['chat', 'stream', 'toolCalling'],
        status: 'active',
      },
      {
        id: 'openai:text-embedding-3-small',
        provider: 'openai',
        model: 'text-embedding-3-small',
        name: 'OpenAI Embedding v3 Small',
        enabled: true,
        default: false,
        capabilities: ['embedding'],
        status: 'active',
      },
    ]);
  }

  async healthCheck(): Promise<boolean> {
    const aiConfig = await this.config.getOpenAIConfig();
    return !!aiConfig.apiKey;
  }
}
