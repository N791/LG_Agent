import { Injectable } from '@nestjs/common';
import { ITutorStrategy, ChatRequestDto } from '../interfaces';
import { LLMResponse } from '../../interfaces/llm-provider.interface';
import { LLMGatewayService } from '../../gateway/llm-gateway.service';
import { PromptBuilderService } from '../../prompt-builder.service';
import { RagService } from '../../rag/rag.service';

@Injectable()
export class AskStrategy implements ITutorStrategy {
  public readonly action = 'ask';

  constructor(
    private readonly gateway: LLMGatewayService,
    private readonly promptBuilder: PromptBuilderService,
    private readonly ragService: RagService,
  ) {}

  async execute(
    request: ChatRequestDto,
  ): Promise<LLMResponse | AsyncGenerator<string, void, unknown>> {
    // Retrieve context from RAG
    const results = await this.ragService.search(request.content, 3);
    const contextStr = results.map((r) => r.chunk.content).join('\n\n');

    // Assemble messages
    const messages = await this.promptBuilder.assembleMessages('ask', {
      content: request.content,
      context: contextStr || 'No specific context available.',
    });

    const llmRequest = { messages };

    // Stream or not
    if (request.stream) {
      return this.gateway.stream(llmRequest);
    }

    return this.gateway.chat(llmRequest);
  }
}
