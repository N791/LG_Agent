import {
  ILLMProvider,
  LLMRequest,
  LLMResponse,
  StreamEvent,
} from '../../src/modules/ai/interfaces/llm-provider.interface';
import { ModelInfoDTO } from '@lg-agent/contracts';

/**
 * MockLLMProvider — 用于测试的假 LLM 供应商。
 * 实现 ILLMProvider 接口，返回固定值，不发送任何真实网络请求。
 */
export class MockLLMProvider implements ILLMProvider {
  readonly name = 'mock';

  chat(_request: LLMRequest): Promise<LLMResponse> {
    return Promise.resolve({
      content: 'Mock response for testing',
      model: 'mock-model',
      provider: this.name,
      usage: {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      },
      finishReason: 'stop',
    });
  }

  async *stream(_request: LLMRequest): AsyncGenerator<StreamEvent, void, unknown> {
    await Promise.resolve();

    yield { content: 'Mock ', model: _request.model ?? 'mock-model-v1' };
    yield { content: 'streamed ', model: _request.model ?? 'mock-model-v1' };
    yield { content: 'response', model: _request.model ?? 'mock-model-v1' };
  }

  embed(_texts: string[]): Promise<number[][]> {
    return Promise.resolve([[0.1, 0.2, 0.3]]);
  }

  listModels(): Promise<ModelInfoDTO[]> {
    return Promise.resolve([
      { id: 'mock-model', name: 'Mock Model', provider: this.name },
    ] as ModelInfoDTO[]);
  }

  healthCheck(): Promise<boolean> {
    return Promise.resolve(true);
  }
}
