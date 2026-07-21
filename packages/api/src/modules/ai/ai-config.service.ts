import { Injectable } from '@nestjs/common';
import { SystemConfigService } from '../platform/config/system-config.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiConfigService {
  constructor(
    private readonly systemConfig: SystemConfigService,
    private readonly envConfig: ConfigService,
  ) {}

  async getOpenAIConfig() {
    return {
      apiKey: await this.resolveConfig('OPENAI_API_KEY'),
      baseURL: await this.resolveConfig('OPENAI_BASE_URL'),
      defaultModel: (await this.resolveConfig('OPENAI_DEFAULT_MODEL')) ?? 'gpt-3.5-turbo',
      timeoutMs: await this.resolveConfig('OPENAI_TIMEOUT_MS', true),
      maxRetries: await this.resolveConfig('OPENAI_MAX_RETRIES', true),
    };
  }

  async getDeepSeekConfig() {
    return {
      apiKey: await this.resolveConfig('DEEPSEEK_API_KEY'),
      baseURL: await this.resolveConfig('DEEPSEEK_BASE_URL'),
      defaultModel: (await this.resolveConfig('DEEPSEEK_DEFAULT_MODEL')) ?? 'deepseek-chat',
    };
  }

  async getMockConfig() {
    return {
      enabled: (await this.resolveConfig('MOCK_LLM_ENABLED')) === 'true',
    };
  }

  async getDefaultProvider(): Promise<string> {
    const provider = await this.resolveConfig('DEFAULT_AI_PROVIDER');
    return provider ?? 'openai';
  }

  async getRagConfig() {
    const enabled = await this.resolveConfig('RAG_ENABLED');
    return {
      enabled: enabled !== 'false', // Default to true unless explicitly 'false'
      topK: (await this.resolveConfig('RAG_TOP_K', true)) ?? 3,
      chunkSize: (await this.resolveConfig('RAG_CHUNK_SIZE', true)) ?? 1000,
    };
  }

  private async resolveConfig(key: string, isNumeric: true): Promise<number | undefined>;
  private async resolveConfig(key: string, isNumeric?: false): Promise<string | undefined>;
  private async resolveConfig(
    key: string,
    isNumeric = false,
  ): Promise<string | number | undefined> {
    let value = await this.systemConfig.get(key);
    if (value === undefined) {
      // Fallback to env
      const envValue = this.envConfig.get<string>(key);
      if (envValue !== undefined) {
        value = envValue;
      }
    }

    if (isNumeric && value !== undefined) {
      return parseInt(value, 10);
    }

    return value;
  }
}
