import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ITutorStrategy, ChatRequestDto } from './interfaces';
import { LLMResponse } from '../interfaces/llm-provider.interface';

@Injectable()
export class AiTutorService {
  private readonly strategies = new Map<string, ITutorStrategy>();

  constructor(@Inject('ITutorStrategies') strategies: ITutorStrategy[]) {
    for (const strategy of strategies) {
      this.strategies.set(strategy.action, strategy);
    }
  }

  async chat(
    request: ChatRequestDto,
  ): Promise<LLMResponse | AsyncGenerator<string, void, unknown>> {
    const strategy = this.strategies.get(request.action);

    if (!strategy) {
      throw new NotFoundException(`No tutor strategy found for action: ${request.action}`);
    }

    return strategy.execute(request);
  }
}
