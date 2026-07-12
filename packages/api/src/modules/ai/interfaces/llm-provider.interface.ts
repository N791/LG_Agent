import { ModelInfoDTO } from '@lg-agent/contracts';

export interface LLMRequest {
  messages: { role: string; content: string }[];
  model?: string;
  temperature?: number;
  stream?: boolean;
}

export interface LLMUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  provider: string;
  usage: LLMUsage;
  finishReason: string;
  metadata?: Record<string, unknown>;
}

export interface ILLMProvider {
  /**
   * Provider identifier (e.g., 'openai', 'deepseek', 'mock')
   */
  readonly name: string;

  /**
   * Standard chat completion
   */
  chat(request: LLMRequest): Promise<LLMResponse>;

  /**
   * Streaming chat completion (returns AsyncIterable)
   */
  stream(request: LLMRequest): AsyncGenerator<string, void, unknown>;

  /**
   * Get embeddings for text chunks
   */
  embed(texts: string[]): Promise<number[][]>;

  /**
   * List available models for this provider
   */
  listModels(): Promise<ModelInfoDTO[]>;

  /**
   * Health check to verify connectivity and authentication
   */
  healthCheck(): Promise<boolean>;
}
