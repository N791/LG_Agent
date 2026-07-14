import { LLMResponse } from '../interfaces/llm-provider.interface';

export class ChatRequestDto {
  action!: string;
  taskId!: string;
  content!: string;
  stream?: boolean;
  conversationId?: string; // Passed internally
}

export interface ITutorStrategy {
  readonly action: string;
  execute(request: ChatRequestDto): Promise<LLMResponse | AsyncGenerator<string, void, unknown>>;
}
