import { Test, TestingModule } from '@nestjs/testing';
import { RagService } from './rag.service';
import { MarkdownChunker } from './markdown-chunker';
import { MemoryVectorStore } from './memory-vector.store';
import { LLMGatewayService } from '../gateway/llm-gateway.service';
import { ProviderRegistry } from '../providers/provider-registry.service';
import { MockLLMProvider } from '../providers/mock.provider';
import { SensitiveDataFilter } from '../filters/sensitive-data.filter';
import { ResponseSafetyFilter } from '../filters/response-safety.filter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma.service';
import { CostCalculator } from '../cost/cost-calculator.service';

import { AiConfigService } from '../ai-config.service';
import { VECTOR_STORE } from './interfaces';
import { AiAuditService } from '../audit/ai-audit.service';

describe('RagService', () => {
  let ragService: RagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        MarkdownChunker,
        MemoryVectorStore,
        {
          provide: VECTOR_STORE,
          useExisting: MemoryVectorStore,
        },
        LLMGatewayService,
        ProviderRegistry,
        MockLLMProvider,
        {
          provide: AiConfigService,
          useValue: {
            getRagConfig: jest.fn().mockResolvedValue({ enabled: true, topK: 3, chunkSize: 1000 }),
            getDefaultProvider: jest.fn().mockResolvedValue('mock'),
            getMockConfig: jest.fn().mockResolvedValue({ enabled: true }),
            getOpenAIConfig: jest.fn().mockResolvedValue({ apiKey: 'test' }),
          },
        },
        {
          provide: SensitiveDataFilter,
          useValue: { filter: jest.fn((content: string) => Promise.resolve(content)) },
        },
        {
          provide: ResponseSafetyFilter,
          useValue: { filterComplete: jest.fn((content: string) => Promise.resolve(content)) },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'LLM_PROVIDER' ? 'mock' : null)) },
        },
        {
          provide: PrismaService,
          useValue: {
            llmRequestLog: { create: jest.fn() },
            llmAuditLog: { create: jest.fn() },
          },
        },
        {
          provide: CostCalculator,
          useValue: {
            estimate: jest.fn().mockResolvedValue(0),
            calculate: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: AiAuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    ragService = module.get<RagService>(RagService);

    // Register Mock Provider manually for tests
    const registry = module.get<ProviderRegistry>(ProviderRegistry);
    const mockProvider = module.get<MockLLMProvider>(MockLLMProvider);
    registry.register(mockProvider);
  });

  it('should import markdown and search successfully', async () => {
    const markdownText = `
# Chapter 1
This is the first chapter about NestJS.

# Chapter 2
This is the second chapter about Prisma.
    `;

    const importedCount = await ragService.importDocument(markdownText, 'test.md');
    expect(importedCount).toBe(1); // One chunk expected because total length < 1000

    const results = await ragService.search('NestJS');
    expect(results).toBeDefined();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.chunk.content).toContain('NestJS');
  });
});
