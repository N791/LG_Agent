import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PromptBuilderService } from './prompt-builder.service';
import { FilePromptRepository } from './providers/file-prompt.repository';
import { LLMGatewayService } from './gateway/llm-gateway.service';
import { ProviderRegistry } from './providers/provider-registry.service';
import { AiConfigService } from './ai-config.service';
import { MockLLMProvider } from './providers/mock.provider';
import { OpenAIProvider } from './providers/openai.provider';
import { DeepSeekProvider } from './providers/deepseek.provider';
import { SensitiveDataFilter } from './filters/sensitive-data.filter';
import { ResponseSafetyFilter } from './filters/response-safety.filter';
import { AiController } from './ai.controller';
import { MarkdownChunker } from './rag/markdown-chunker';
import { MemoryVectorStore } from './rag/memory-vector.store';
import { RagService } from './rag/rag.service';
import { JsonFilterRuleRepository } from './filters/rule-engine/repositories/json-rule.repository';
import { MaskActionExecutor } from './filters/rule-engine/executors/mask-action.executor';
import { BlockActionExecutor } from './filters/rule-engine/executors/block-action.executor';
import { RegexMatcher } from './filters/rule-engine/matchers/regex.matcher';
import { KeywordMatcher } from './filters/rule-engine/matchers/keyword.matcher';
import { ContentFilterEngine } from './filters/rule-engine/rule-engine.service';
import { AiConversationService } from './conversation/ai-conversation.service';
import { PromptAssemblyPipeline } from './conversation/prompt-assembly.pipeline';
import {
  ContextBuilder,
  WorkspaceContextProvider,
  ActiveFileProvider,
} from './conversation/context-builder';
import { AskStrategy } from './tutor/strategies/ask.strategy';
import { CodeReviewStrategy } from './tutor/strategies/code-review.strategy';
import { ExplainErrorStrategy } from './tutor/strategies/explain-error.strategy';
import { JsonPricingRepository } from './cost/json-pricing.repository';
import { CostCalculator } from './cost/cost-calculator.service';
import { ModelRegistryService } from './model-registry.service';
import { Ai2TaskService } from './ai2task.service';
import { AiReviewService } from './tutor/ai-review.service';
import { QuickActionRegistry } from './tutor/quick-actions/quick-action.registry';
import { StaticFollowUpProvider } from './tutor/quick-actions/static-follow-up.provider';
import { KnowledgeController } from './knowledge/knowledge.controller';
import { MarkdownKnowledgeRepository } from './knowledge/markdown-knowledge.repository';
import { KnowledgeIndexService } from './knowledge/knowledge-index.service';

import { PrismaModule } from '../../common/prisma.module';

import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [ConfigModule, PrismaModule, WorkspaceModule],
  controllers: [AiController, KnowledgeController],
  providers: [
    {
      provide: 'IPromptRepository',
      useClass: FilePromptRepository,
    },
    {
      provide: 'IFilterRuleRepository',
      useClass: JsonFilterRuleRepository,
    },
    MaskActionExecutor,
    BlockActionExecutor,
    {
      provide: 'IActionExecutors',
      useFactory: (mask: MaskActionExecutor, block: BlockActionExecutor) => [mask, block],
      inject: [MaskActionExecutor, BlockActionExecutor],
    },
    RegexMatcher,
    KeywordMatcher,
    {
      provide: 'IMatchers',
      useFactory: (regex: RegexMatcher, keyword: KeywordMatcher) => [regex, keyword],
      inject: [RegexMatcher, KeywordMatcher],
    },
    ContentFilterEngine,
    PromptBuilderService,
    WorkspaceContextProvider,
    ActiveFileProvider,
    ContextBuilder,
    PromptAssemblyPipeline,
    AiConfigService,
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
    AskStrategy,
    CodeReviewStrategy,
    ExplainErrorStrategy,
    {
      provide: 'ITutorStrategies',
      useFactory: (
        ask: AskStrategy,
        codeReview: CodeReviewStrategy,
        explain: ExplainErrorStrategy,
      ) => [ask, codeReview, explain],
      inject: [AskStrategy, CodeReviewStrategy, ExplainErrorStrategy],
    },
    {
      provide: 'IPricingRepository',
      useClass: JsonPricingRepository,
    },
    CostCalculator,
    ModelRegistryService,
    AiConversationService,
    Ai2TaskService,
    AiReviewService,
    {
      provide: 'IQuickActionProvider',
      useClass: StaticFollowUpProvider,
    },
    QuickActionRegistry,
    StaticFollowUpProvider,
    MarkdownKnowledgeRepository,
    KnowledgeIndexService,
  ],
  exports: [
    PromptBuilderService,
    LLMGatewayService,
    RagService,
    AiConversationService,
    CostCalculator,
    ModelRegistryService,
    Ai2TaskService,
    AiReviewService,
    KnowledgeIndexService,
  ],
})
export class AiModule implements OnModuleInit {
  private readonly logger = new Logger(AiModule.name);

  constructor(
    private readonly providerRegistry: ProviderRegistry,
    private readonly mockLLMProvider: MockLLMProvider,
    private readonly openAIProvider: OpenAIProvider,
    private readonly deepSeekProvider: DeepSeekProvider,

    private readonly quickActionRegistry: QuickActionRegistry,
    private readonly staticFollowUpProvider: StaticFollowUpProvider,
    private readonly knowledgeIndexService: KnowledgeIndexService,
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

    // Always register Mock Provider so it can be selected via System Settings UI
    this.providerRegistry.register(this.mockLLMProvider);

    // Set Fallback (handled inside getFallbackProvider based on config)
    // Register Quick Actions
    this.quickActionRegistry.register(this.staticFollowUpProvider);

    // Build Knowledge Index
    await this.knowledgeIndexService.buildIndex();

    // Verify at least one provider is available
    const available = this.providerRegistry.getAllProviders();
    if (available.length === 0) {
      this.logger.warn(
        'NO LLM Providers are currently available or configured! AI services will fail.',
      );
    }
  }
}
