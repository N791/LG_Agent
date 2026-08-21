import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ILLMProvider } from '../interfaces/llm-provider.interface';
import { AiConfigService } from '../ai-config.service';

@Injectable()
export class ProviderRegistry {
  private readonly logger = new Logger(ProviderRegistry.name);
  private readonly providers = new Map<string, ILLMProvider>();

  constructor(private readonly config: AiConfigService) {}

  register(provider: ILLMProvider) {
    this.providers.set(provider.name, provider);
    this.logger.log(`Registered LLM Provider: ${provider.name}`);
  }

  getProvider(name: string): ILLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new NotFoundException({ message: 'errors.ai.providerNotFound', args: { name } });
    }
    return provider;
  }

  getAllProviders(): ILLMProvider[] {
    return Array.from(this.providers.values());
  }

  async getFallbackProvider(): Promise<ILLMProvider> {
    // 1. If explicit default provider is configured and available
    const defaultName = await this.config.getDefaultProvider();
    if (defaultName) {
      const provider = this.providers.get(defaultName);
      if (provider) {
        await this.assertSelectable(provider);
        return provider;
      }
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
      await this.assertSelectable(mockProvider);
      return mockProvider;
    }

    throw new Error('No LLM Provider available to process the request.');
  }

  private async assertSelectable(provider: ILLMProvider): Promise<void> {
    if (provider.name !== 'mock') return;
    const mock = await this.config.getMockConfig();
    if (!mock.enabled) {
      throw new Error(
        'AI_PROVIDER_NOT_CONFIGURED: Mock Provider is restricted to unit/E2E fixtures. Configure a production LLM provider.',
      );
    }
  }
}
