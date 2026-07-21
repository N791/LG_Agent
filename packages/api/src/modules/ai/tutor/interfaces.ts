import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';
import { LLMResponse, StreamEvent } from '../interfaces/llm-provider.interface';

export class ChatRequestDto {
  @IsString()
  @IsNotEmpty()
  action!: string;

  @IsString()
  @IsNotEmpty()
  taskId!: string;

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsBoolean()
  @IsOptional()
  stream?: boolean;

  @IsString()
  @IsOptional()
  conversationId?: string; // Passed internally

  @IsString()
  @IsOptional()
  activeFile?: string; // Injects focus context
}

export interface ITutorStrategy {
  readonly action: string;
  execute(
    request: ChatRequestDto,
  ): Promise<LLMResponse | AsyncGenerator<StreamEvent, void, unknown>>;
}
