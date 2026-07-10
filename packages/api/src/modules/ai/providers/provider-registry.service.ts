import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILLMProvider } from '../interfaces/llm-provider.interface';

@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly providers = new Map<string, ILLMProvider>();

  constructor(private readonly configService: ConfigService) {}

  register(provider: ILLMProvider) {
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered LLM Provider: ${provider.name}`);
  }

  getProvider(name: string): ILLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new NotFoundException(`LLM Provider '${name}' not found.`);
    }
    return provider;
  }

  getAllProviders(): ILLMProvider[] {
    return Array.from(this.providers.values());
  }

  getFallbackProvider(): ILLMProvider {
    // 1. If explicit default provider is configured and available
    const defaultName = this.configService.get<string>('LLM_PROVIDER');
    if (defaultName) {
      const provider = this.providers.get(defaultName);
      if (provider) return provider;
    }

    // 2. Production fallback chain: OpenAI -> DeepSeek -> Ollama
    const fallbackChain = ['openai', 'deepseek', 'ollama'];
    for (const p of fallbackChain) {
      const provider = this.providers.get(p);
      if (provider) {
        return provider;
      }
    }

    // 3. If mock is the ONLY one available (development mode)
    const mockProvider = this.providers.get('mock');
    if (mockProvider) {
      this.logger.warn('No production providers available. Falling back to Mock Provider.');
      return mockProvider;
    }

    throw new Error('No LLM Provider available to process the request.');
  }
}
