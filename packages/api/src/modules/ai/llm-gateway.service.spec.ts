import { Test, TestingModule } from '@nestjs/testing';
import { LLMGatewayService } from './gateway/llm-gateway.service';
import { ProviderRegistry } from './providers/provider-registry.service';
import { MockLLMProvider } from './providers/mock.provider';
import { SensitiveDataFilter } from './filters/sensitive-data.filter';
import { ResponseSafetyFilter } from './filters/response-safety.filter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { CostCalculator } from './cost/cost-calculator.service';
import { AiAuditService } from './audit/ai-audit.service';
import type { AiRequestAuditRecord } from './audit/ai-audit.service';
import type { ILLMProvider } from './interfaces/llm-provider.interface';

import { AiConfigService } from './ai-config.service';

describe('LLMGatewayService', () => {
  let gateway: LLMGatewayService;
  let registry: ProviderRegistry;
  let sensitiveDataFilter: SensitiveDataFilter;
  let responseSafetyFilter: ResponseSafetyFilter;
  let auditService: jest.Mocked<Pick<AiAuditService, 'record'>>;
  let filterChunkMock: jest.MockedFunction<(chunk: string) => Promise<string>>;

  beforeEach(async () => {
    filterChunkMock = jest.fn((chunk: string) => Promise.resolve(chunk));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LLMGatewayService,
        ProviderRegistry,
        MockLLMProvider,
        {
          provide: AiConfigService,
          useValue: {
            getDefaultProvider: jest.fn().mockResolvedValue('mock'),
            getMockConfig: jest.fn().mockResolvedValue({ enabled: true }),
          },
        },
        {
          provide: SensitiveDataFilter,
          useValue: { filter: jest.fn((content: string) => Promise.resolve(content)) },
        },
        {
          provide: ResponseSafetyFilter,
          useValue: {
            filterComplete: jest.fn((content: string) => Promise.resolve(content)),
            filterChunk: filterChunkMock,
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string) => (key === 'LLM_PROVIDER' ? 'mock' : null)) },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
        {
          provide: AiAuditService,
          useValue: { record: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: CostCalculator,
          useValue: {
            estimate: jest.fn().mockResolvedValue(0),
            calculate: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();

    gateway = module.get<LLMGatewayService>(LLMGatewayService);
    registry = module.get<ProviderRegistry>(ProviderRegistry);
    sensitiveDataFilter = module.get<SensitiveDataFilter>(SensitiveDataFilter);
    responseSafetyFilter = module.get<ResponseSafetyFilter>(ResponseSafetyFilter);
    auditService = module.get<jest.Mocked<Pick<AiAuditService, 'record'>>>(AiAuditService);

    // Register Mock Provider manually for tests
    const mockProvider = module.get<MockLLMProvider>(MockLLMProvider);
    registry.register(mockProvider);
  });

  it('should list available models', () => {
    const models = gateway.getAvailableModels();
    expect(models).toContain('mock');
  });

  it('should process chat request via mock provider and return structured response', async () => {
    const response = await gateway.chat({
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(response.provider).toBe('mock');
    expect(response.content).toContain('[MOCK RESPONSE]');
    expect(response.usage).toBeDefined();
    expect(response.usage.totalTokens).toBeGreaterThan(0);
    const audit = lastAuditRecord(auditService);
    expect(audit.requestType).toBe('chat');
    expect(audit.provider).toBe('mock');
    expect(audit.promptHash).toMatch(/^[a-f0-9]{64}$/);
    expect(typeof audit.traceId).toBe('string');
  });

  it('audits streaming usage and filters every emitted chunk', async () => {
    const chunks = [];
    for await (const event of gateway.stream({
      messages: [{ role: 'user', content: 'stream this' }],
      audit: { userId: '00000000-0000-0000-0000-000000000001' },
    })) {
      chunks.push(event.content);
    }

    expect(chunks.join('')).toContain('[MOCK STREAM RESPONSE]');
    expect(filterChunkMock).toHaveBeenCalled();
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ requestType: 'stream', status: 'success' }),
    );
  });

  it('audits embeddings through the same gateway contract', async () => {
    const vectors = await gateway.embed(['NestJS']);

    expect(vectors).toHaveLength(1);
    const audit = lastAuditRecord(auditService);
    expect(audit.requestType).toBe('embed');
    expect(typeof audit.promptTokens).toBe('number');
  });

  it('records the provider fallback path', async () => {
    const failingProvider: ILLMProvider = {
      name: 'failing',
      chat: () => Promise.reject(new Error('primary unavailable')),
      stream: async function* () {
        await Promise.resolve();
        yield { content: '' };
      },
      embed: () => Promise.resolve([]),
      listModels: () => Promise.resolve([]),
      healthCheck: () => Promise.resolve(true),
    };
    registry.register(failingProvider);

    const response = await gateway.chat(
      { messages: [{ role: 'user', content: 'fallback' }] },
      'failing',
    );

    expect(response.provider).toBe('mock');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'mock', fallbackFrom: 'failing' }),
    );
  });

  it('should filter sensitive data in request', async () => {
    const provider = registry.getProvider('mock');
    const chatSpy = jest.spyOn(provider, 'chat');
    jest.spyOn(sensitiveDataFilter, 'filter').mockResolvedValue('My key is [REDACTED]');
    const response = await gateway.chat({
      messages: [{ role: 'user', content: 'My key is sk-123456789012345678901234567890123456' }],
    });

    expect(response.content).toContain('Mock processing successful');
    expect(chatSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'My key is [REDACTED]' }],
      }),
    );
  });

  it('should filter unsafe patterns in response', async () => {
    const mockProvider = registry.getProvider('mock');
    jest.spyOn(mockProvider, 'chat').mockResolvedValue({
      content: 'Here is how you rm -rf /',
      model: 'mock',
      provider: 'mock',
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
      finishReason: 'stop',
    });

    const filterSpy = jest
      .spyOn(responseSafetyFilter, 'filterComplete')
      .mockResolvedValue('[REDACTED UNSAFE CONTENT]');

    const response = await gateway.chat({
      messages: [{ role: 'user', content: 'Test' }],
    });

    expect(response.content).toContain('[REDACTED UNSAFE CONTENT]');
    expect(filterSpy).toHaveBeenCalled();
  });
});

function lastAuditRecord(
  auditService: jest.Mocked<Pick<AiAuditService, 'record'>>,
): AiRequestAuditRecord {
  const call = auditService.record.mock.calls.at(-1);
  if (!call) throw new Error('Expected an AI audit record');
  return call[0];
}
