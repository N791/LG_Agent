import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PromptBuilderService } from './prompt-builder.service';
import { FilePromptRepository } from './providers/file-prompt.repository';
import { LLMGatewayService } from './gateway/llm-gateway.service';
import { ProviderRegistry } from './providers/provider-registry.service';
import { MockLLMProvider } from './providers/mock.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { SensitiveDataFilter } from './filters/sensitive-data.filter';
import { ResponseSafetyFilter } from './filters/response-safety.filter';
import { AiController } from './ai.controller';
import { MarkdownChunker } from './rag/markdown-chunker';
import { MemoryVectorStore } from './rag/memory-vector.store';
import { RagService } from './rag/rag.service';

@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'IPromptRepository',
      useClass: FilePromptRepository,
    },
    PromptBuilderService,
    LLMGatewayService,
    ProviderRegistry,
    MockLLMProvider,
    OpenAIProvider,
    DeepSeekProvider,
    SensitiveDataFilter,
    ResponseSafetyFilter,
    MarkdownChunker,
    MemoryVectorStore,
    RagService,
  ],
  exports: [PromptBuilderService, LLMGatewayService, RagService],
  controllers: [AiController],
})
export class AiModule implements OnModuleInit {
  private readonly logger = new Logger(AiModule.name);

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly mockLLMProvider: MockLLMProvider,
    private readonly openAIProvider: OpenAIProvider,
    private readonly deepSeekProvider: DeepSeekProvider,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing AI Module Providers...');

    // Register OpenAI if configured
    if (await this.openAIProvider.healthCheck()) {
      this.providerRegistry.register(this.openAIProvider);
    }

    // Register DeepSeek if configured
    if (await this.deepSeekProvider.healthCheck()) {
      this.providerRegistry.register(this.deepSeekProvider);
    }

    // Register Mock Provider ONLY if enabled in config
    const enableMock = this.configService.get<boolean>('ENABLE_MOCK_PROVIDER');
    if (enableMock) {
      this.logger.log('Mock Provider is ENABLED via configuration.');
      this.providerRegistry.register(this.mockLLMProvider);
    }

    // Verify at least one provider is available
    const available = this.providerRegistry.getAllProviders();
    if (available.length === 0) {
      this.logger.warn(
        'NO LLM Providers are currently available or configured! AI services will fail.',
      );
    }
  }
}
