import { Injectable } from '@nestjs/common';
import { ITutorStrategy } from '../interfaces';
import type { ChatRequestDTO } from '@lg-agent/contracts';
import { LLMResponse, StreamEvent } from '../../interfaces/llm-provider.interface';
import { LLMGatewayService } from '../../gateway/llm-gateway.service';
import { PromptBuilderService } from '../../prompt-builder.service';

@Injectable()
export class CodeReviewStrategy implements ITutorStrategy {
  public readonly action = 'code_review';

  constructor(
    private readonly gateway: LLMGatewayService,
    private readonly promptBuilder: PromptBuilderService,
  ) {}

  async execute(
    request: ChatRequestDTO,
  ): Promise<LLMResponse | AsyncGenerator<StreamEvent, void, unknown>> {
    const messages = await this.promptBuilder.assembleMessages('code_review', {
      content: request.content,
    });

    if (request.stream) {
      return this.gateway.stream({ messages });
    }

    return this.gateway.chat({ messages });
  }
}
