import { LLMResponse, StreamEvent } from '../interfaces/llm-provider.interface';
import type { ChatRequestDTO } from '@lg-agent/contracts';

/** @deprecated Import ChatRequestDTO from @lg-agent/contracts in new code. */
export type ChatRequestDto = ChatRequestDTO;

export interface ITutorStrategy {
  readonly action: string;
  execute(
    request: ChatRequestDTO,
  ): Promise<LLMResponse | AsyncGenerator<StreamEvent, void, unknown>>;
}
