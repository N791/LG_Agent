import { Module, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';
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
import { PgVectorStore } from './rag/pgvector.store';
import { VECTOR_STORE } from './rag/interfaces';
import { RagService } from './rag/rag.service';
import { JsonFilterRuleRepository } from './filters/rule-engine/repositories/json-rule.repository';
import { MaskActionExecutor } from './filters/rule-engine/executors/mask-action.executor';
import { BlockActionExecutor } from './filters/rule-engine/executors/block-action.executor';
import { RegexMatcher } from './filters/rule-engine/matchers/regex.matcher';
import { KeywordMatcher } from './filters/rule-engine/matchers/keyword.matcher';
import { ContentFilterEngine } from './filters/rule-engine/rule-engine.service';
import { AiConversationService } from './conversation/ai-conversation.service';
import { PromptAssemblyPipeline } from './conversation/prompt-assembly.pipeline';
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
import { AiAuditService } from './audit/ai-audit.service';
import { AiAuditController } from './audit/ai-audit.controller';
import {
  CODE_RETRIEVER,
  CONTEXT_ORCHESTRATOR,
  DOCUMENT_RETRIEVER,
  QUERY_ROUTER,
} from './retrieval/interfaces';
import { LegacyDocumentRetrieverAdapter } from './retrieval/legacy-document-retriever.adapter';
import { QueryRouterService } from './retrieval/query-router.service';
import { ContextOrchestratorService } from './retrieval/context-orchestrator.service';
import { ContextBudgetService } from './retrieval/context-budget.service';
import { ConversationCompactorService } from './retrieval/conversation-compactor.service';
import { ConversationCompactionService } from './retrieval/conversation-compaction.service';
import { RetrievalCacheService } from './retrieval/retrieval-cache.service';
import { RetrievalFeatureFlags } from './retrieval/retrieval-feature-flags.service';
import { RetrievalUxService } from './retrieval/retrieval-ux.service';
import {
  DOCUMENT_EXPANSION_STORE,
  DOCUMENT_KEYWORD_SEARCH,
  DOCUMENT_RERANKER,
  DOCUMENT_VECTOR_SEARCH,
  RETRIEVAL_OBSERVER,
} from './retrieval/document/hybrid-retrieval.interfaces';
import { DocumentStructureParser } from './retrieval/document/document-structure.parser';
import { StructuredDocumentChunker } from './retrieval/document/structured-document.chunker';
import {
  DOCUMENT_EMBEDDING_PROVIDER,
  DOCUMENT_INDEX_REPOSITORY,
  StructuredDocumentIndexService,
} from './retrieval/document/structured-document-index.service';
import { GatewayDocumentEmbeddingAdapter } from './retrieval/document/gateway-document-embedding.adapter';
import { PrismaDocumentIndexRepository } from './retrieval/document/prisma-document-index.repository';
import {
  PrismaDocumentExpansionAdapter,
  PrismaDocumentSearchStore,
  PrismaKeywordDocumentSearchAdapter,
  PrismaVectorDocumentSearchAdapter,
} from './retrieval/document/prisma-document-search.adapters';
import { ReciprocalRankFusionService } from './retrieval/document/reciprocal-rank-fusion.service';
import { BoundedLexicalRerankerAdapter } from './retrieval/document/bounded-reranker.adapter';
import { RetrievalObserverService } from './retrieval/document/retrieval-observer.service';
import { HybridDocumentRetrieverAdapter } from './retrieval/document/hybrid-document-retriever.adapter';
import { RolloutDocumentRetrieverAdapter } from './retrieval/document/rollout-document-retriever.adapter';
import { DocumentRetrievalEvaluator } from './retrieval/document/document-retrieval.evaluator';
import { RetrievalSecurityService } from './retrieval/retrieval-security.service';
import { RetrievalTraceService } from './retrieval/retrieval-trace.service';
import { RetrievalObservabilityService } from './retrieval/retrieval-observability.service';
import { IndexJobObservabilityService } from './retrieval/index-job-observability.service';
import { RetrievalIndexController } from './retrieval/retrieval-index.controller';
import { RetrievalRolloutService } from './retrieval/retrieval-rollout.service';
import { RetrievalEvaluatorService } from './retrieval/evaluation/retrieval-evaluator.service';
import { RetrievalShadowService } from './retrieval/evaluation/retrieval-shadow.service';
import {
  AstCodeRetrieverAdapter,
  CODE_INDEX_REPOSITORY,
  CODE_RETRIEVAL_STORE,
  CodeLanguageDetector,
  CodeParserRegistry,
  PrismaCodeIndexRepository,
  PrismaCodeRetrievalStore,
  RepositoryCodeIndexService,
  TypeScriptCodeParserAdapter,
} from './retrieval/code';

import { PrismaModule } from '../../common/prisma.module';

import { WorkspaceModule } from '../workspace';

@Module({
  imports: [ConfigModule, PrismaModule, WorkspaceModule],
  controllers: [AiController, KnowledgeController, AiAuditController, RetrievalIndexController],
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
    PgVectorStore,
    {
      provide: VECTOR_STORE,
      useFactory: (
        config: ConfigService,
        memoryStore: MemoryVectorStore,
        pgVectorStore: PgVectorStore,
      ) =>
        config.get<string>('RAG_VECTOR_STORE', 'memory') === 'pgvector'
          ? pgVectorStore
          : memoryStore,
      inject: [ConfigService, MemoryVectorStore, PgVectorStore],
    },
    RagService,
    RetrievalFeatureFlags,
    RetrievalSecurityService,
    RetrievalTraceService,
    RetrievalObservabilityService,
    IndexJobObservabilityService,
    RetrievalRolloutService,
    RetrievalEvaluatorService,
    RetrievalShadowService,
    RetrievalUxService,
    LegacyDocumentRetrieverAdapter,
    DocumentStructureParser,
    StructuredDocumentChunker,
    StructuredDocumentIndexService,
    GatewayDocumentEmbeddingAdapter,
    PrismaDocumentIndexRepository,
    PrismaDocumentSearchStore,
    PrismaKeywordDocumentSearchAdapter,
    PrismaVectorDocumentSearchAdapter,
    PrismaDocumentExpansionAdapter,
    ReciprocalRankFusionService,
    BoundedLexicalRerankerAdapter,
    RetrievalObserverService,
    HybridDocumentRetrieverAdapter,
    RolloutDocumentRetrieverAdapter,
    DocumentRetrievalEvaluator,
    { provide: DOCUMENT_INDEX_REPOSITORY, useExisting: PrismaDocumentIndexRepository },
    { provide: DOCUMENT_EMBEDDING_PROVIDER, useExisting: GatewayDocumentEmbeddingAdapter },
    { provide: DOCUMENT_KEYWORD_SEARCH, useExisting: PrismaKeywordDocumentSearchAdapter },
    { provide: DOCUMENT_VECTOR_SEARCH, useExisting: PrismaVectorDocumentSearchAdapter },
    { provide: DOCUMENT_EXPANSION_STORE, useExisting: PrismaDocumentExpansionAdapter },
    { provide: DOCUMENT_RERANKER, useExisting: BoundedLexicalRerankerAdapter },
    { provide: RETRIEVAL_OBSERVER, useExisting: RetrievalObserverService },
    CodeLanguageDetector,
    CodeParserRegistry,
    TypeScriptCodeParserAdapter,
    RepositoryCodeIndexService,
    PrismaCodeIndexRepository,
    PrismaCodeRetrievalStore,
    AstCodeRetrieverAdapter,
    { provide: CODE_INDEX_REPOSITORY, useExisting: PrismaCodeIndexRepository },
    { provide: CODE_RETRIEVAL_STORE, useExisting: PrismaCodeRetrievalStore },
    QueryRouterService,
    ContextBudgetService,
    ConversationCompactorService,
    ConversationCompactionService,
    RetrievalCacheService,
    ContextOrchestratorService,
    { provide: DOCUMENT_RETRIEVER, useExisting: RolloutDocumentRetrieverAdapter },
    { provide: CODE_RETRIEVER, useExisting: AstCodeRetrieverAdapter },
    { provide: QUERY_ROUTER, useExisting: QueryRouterService },
    { provide: CONTEXT_ORCHESTRATOR, useExisting: ContextOrchestratorService },
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
    AiAuditService,
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
    StructuredDocumentIndexService,
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
    DOCUMENT_RETRIEVER,
    CODE_RETRIEVER,
    RepositoryCodeIndexService,
    QUERY_ROUTER,
    CONTEXT_ORCHESTRATOR,
    ConversationCompactorService,
    ConversationCompactionService,
    RetrievalCacheService,
    RetrievalSecurityService,
    RetrievalTraceService,
    RetrievalObservabilityService,
    RetrievalRolloutService,
    RetrievalEvaluatorService,
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

    // Rebuild out of the startup critical path; readiness is exposed by KnowledgeController.
    this.knowledgeIndexService.scheduleRebuild();

    // Verify at least one provider is available
    const available = this.providerRegistry.getAllProviders();
    if (available.length === 0) {
      this.logger.warn(
        'NO LLM Providers are currently available or configured! AI services will fail.',
      );
    }
  }
}
