import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
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
export class DeepSeekProvider implements ILLMProvider {
  public readonly name = 'deepseek';

  constructor(private readonly config: AiConfigService) {}

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const aiConfig = await this.config.getDeepSeekConfig();

    if (!aiConfig.apiKey) {
      throw new Error('DeepSeek Provider is not properly configured (missing API Key)');
    }

    const messages = request.messages.map((m) =>
      m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content),
    );

    const modelName = request.model ?? aiConfig.defaultModel;

    const chatInstance = new ChatOpenAI({
      openAIApiKey: aiConfig.apiKey,
      configuration: { baseURL: aiConfig.baseURL ?? 'https://api.deepseek.com/v1' },
      modelName,
      temperature: request.temperature,
    });

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

  async *stream(request: LLMRequest): AsyncGenerator<StreamEvent, void, unknown> {
    const aiConfig = await this.config.getDeepSeekConfig();

    if (!aiConfig.apiKey) {
      throw new Error('DeepSeek Provider is not properly configured (missing API Key)');
    }

    const messages = request.messages.map((m) =>
      m.role === 'system' ? new SystemMessage(m.content) : new HumanMessage(m.content),
    );

    const modelName = request.model ?? aiConfig.defaultModel;

    const chatInstance = new ChatOpenAI({
      openAIApiKey: aiConfig.apiKey,
      configuration: { baseURL: aiConfig.baseURL ?? 'https://api.deepseek.com/v1' },
      modelName,
      temperature: request.temperature,
    });

    const stream = await chatInstance.stream(messages);
    for await (const chunk of stream) {
      const content =
        typeof chunk.content === 'string' ? chunk.content : JSON.stringify(chunk.content);

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

  embed(_texts: string[]): Promise<number[][]> {
    return Promise.reject(
      new Error('DeepSeek embedding is not officially supported by this provider wrapper yet.'),
    );
  }

  listModels(): Promise<ModelInfoDTO[]> {
    return Promise.resolve([
      {
        id: 'deepseek:deepseek-chat',
        provider: 'deepseek',
        model: 'deepseek-chat',
        name: 'DeepSeek Chat',
        enabled: true,
        default: true,
        capabilities: ['chat', 'stream'],
        status: 'active',
      },
      {
        id: 'deepseek:deepseek-coder',
        provider: 'deepseek',
        model: 'deepseek-coder',
        name: 'DeepSeek Coder',
        enabled: true,
        default: false,
        capabilities: ['chat', 'stream'],
        status: 'active',
      },
    ]);
  }

  async healthCheck(): Promise<boolean> {
    const aiConfig = await this.config.getDeepSeekConfig();
    return !!aiConfig.apiKey;
  }
}
