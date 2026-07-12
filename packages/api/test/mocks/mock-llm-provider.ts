import { Injectable } from '@nestjs/common';
import { BaseLLMProvider } from '../../src/modules/ai/gateway/providers/base.provider';
import { ModelInfoDTO } from '../../src/modules/ai/dto/model-info.dto';

@Injectable()
export class MockLLMProvider extends BaseLLMProvider {
  name = 'mock-provider';

  async listModels(): Promise<ModelInfoDTO[]> {
    return [
      {
        id: 'mock-model-1',
        provider: this.name,
        model: 'mock-model-1',
        name: 'Mock Model 1',
        enabled: true,
        default: true,
        contextWindow: 4096,
        capabilities: ['chat'],
        status: 'ready',
      },
    ];
  }

  async generate(
    model: string,
    prompt: string,
    options?: any,
  ): Promise<{ content: string; usage: any; model: string; finishReason?: string }> {
    return {
      content: 'This is a mocked LLM response',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      model: model || 'mock-model-1',
      finishReason: 'stop',
    };
  }
}
