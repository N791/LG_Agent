import { Injectable } from '@nestjs/common';
import {
  ILLMProvider,
  LLMRequest,
  LLMResponse,
  StreamEvent,
} from '../interfaces/llm-provider.interface';
import { ModelInfoDTO } from '@lg-agent/contracts';

@Injectable()
export class MockLLMProvider implements ILLMProvider {
  public readonly name = 'mock';

  chat(request: LLMRequest): Promise<LLMResponse> {
    const promptTokens = request.messages.reduce((acc, m) => acc + m.content.length / 4, 0);
    const content = `[MOCK RESPONSE] Received ${String(request.messages.length)} messages. Mock processing successful.`;
    const completionTokens = content.length / 4;

    return Promise.resolve({
      content,
      model: request.model ?? 'mock-model-v1',
      provider: this.name,
      usage: {
        promptTokens: Math.ceil(promptTokens),
        completionTokens: Math.ceil(completionTokens),
        totalTokens: Math.ceil(promptTokens + completionTokens),
      },
      finishReason: 'stop',
      metadata: { mock: true, timestamp: Date.now() },
    });
  }

  async *stream(request: LLMRequest): AsyncGenerator<StreamEvent, void, unknown> {
    yield { content: '[MOCK ' };
    yield { content: 'STREAM ' };

    // Calculate fixed simulated tokens or based on request
    const promptTokens =
      request.messages.reduce((acc, m) => acc + Math.ceil(m.content.length / 4), 0) || 10;
    const completionTokens = 20; // Fixed completion tokens

    yield {
      content: 'RESPONSE]',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      model: request.model ?? 'mock-model-v1',
    };
    await Promise.resolve();
  }

  embed(texts: string[]): Promise<number[][]> {
    // Return mock 1536-dimensional vectors (all zeros with minor variations)
    return Promise.resolve(
      texts.map((text) => {
        const vec = Array<number>(1536).fill(0.01);
        // Hash part of the text into the vector to give it some 'uniqueness'
        vec[0] = text.length;
        vec[1] = text.charCodeAt(0);
        return vec;
      }),
    );
  }

  listModels(): Promise<ModelInfoDTO[]> {
    return Promise.resolve([
      {
        id: 'mock:mock-model-v1',
        provider: 'mock',
        model: 'mock-model-v1',
        name: 'Mock Model v1',
        enabled: true,
        default: true,
        capabilities: ['chat', 'stream', 'toolCalling'],
        status: 'active',
      },
      {
        id: 'mock:mock-embedding-v1',
        provider: 'mock',
        model: 'mock-embedding-v1',
        name: 'Mock Embedding v1',
        enabled: true,
        default: false,
        capabilities: ['embedding'],
        status: 'active',
      },
    ]);
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true); // Mock is always healthy
  }
}
