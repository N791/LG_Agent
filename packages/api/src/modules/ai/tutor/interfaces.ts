import { LLMResponse } from '../interfaces/llm-provider.interface';

export class ChatRequestDto {
  action!: string;
  content!: string;
  stream?: boolean;
}

export interface ITutorStrategy {
  readonly action: string;
  execute(request: ChatRequestDto): Promise<LLMResponse | AsyncGenerator<string, void, unknown>>;
}
