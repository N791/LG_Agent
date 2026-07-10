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

describe('RagService', () => {
  let ragService: RagService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagService,
        MarkdownChunker,
        MemoryVectorStore,
        LLMGatewayService,
        ProviderRegistry,
        MockLLMProvider,
        SensitiveDataFilter,
        ResponseSafetyFilter,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'LLM_PROVIDER' ? 'mock' : null)) },
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
    expect(results[0]?.chunk.content).toBe('This is the third chunk');
  });
});
