import { Injectable } from '@nestjs/common';
import { ITutorStrategy, ChatRequestDto } from '../interfaces';
import { LLMResponse } from '../../interfaces/llm-provider.interface';
import { LLMGatewayService } from '../../gateway/llm-gateway.service';
import { PromptBuilderService } from '../../prompt-builder.service';

@Injectable()
export class ExplainErrorStrategy implements ITutorStrategy {
  public readonly action = 'explain_error';

  constructor(
    private readonly gateway: LLMGatewayService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  async execute(
    request: ChatRequestDto,
  ): Promise<LLMResponse | AsyncGenerator<string, void, unknown>> {
    const messages = await this.promptBuilder.assembleMessages('explain_error', {
      content: request.content,
    });

    if (request.stream) {
      return this.gateway.stream({ messages });
    }

    return this.gateway.chat({ messages });
  }
}
