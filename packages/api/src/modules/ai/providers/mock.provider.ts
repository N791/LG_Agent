import { Injectable } from '@nestjs/common';
import { ILLMProvider, LLMRequest, LLMResponse } from '../interfaces/llm-provider.interface';

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

  stream(_request: LLMRequest): Promise<AsyncIterable<unknown>> {
    // Generate a mock async iterable stream
    async function* generate() {
      const words = ['[MOCK STREAM]', 'Received', 'messages.', 'Done.'];
      for (const word of words) {
        yield { content: word + ' ' };
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }
    return Promise.resolve(generate());
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

  listModels(): Promise<string[]> {
    return Promise.resolve(['mock-model-v1', 'mock-embedding-v1']);
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true); // Mock is always healthy
  }
}
