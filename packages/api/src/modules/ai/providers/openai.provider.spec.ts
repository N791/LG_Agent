import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { OpenAIProvider } from './openai.provider';
import { LLMRequest } from '../interfaces/llm-provider.interface';

import { AiConfigService } from '../ai-config.service';

// Mock ChatOpenAI
jest.mock('@langchain/openai', () => {
  return {
    ChatOpenAI: jest.fn().mockImplementation(() => {
      return {
        invoke: jest.fn().mockResolvedValue({
          content: 'This is a mock OpenAI response',
          response_metadata: {
            tokenUsage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
            finishReason: 'stop',
          },
        }),
        stream: jest.fn().mockResolvedValue(
          (async function* () {
            yield { content: 'chunk1' };
            yield { content: 'chunk2' };
            await Promise.resolve();
          })(),
        ),
      };
    }),
    OpenAIEmbeddings: jest.fn().mockImplementation(() => {
      return {
        embedDocuments: jest.fn().mockResolvedValue([
          [0.1, 0.2],
          [0.3, 0.4],
        ]),
      };
    }),
  };
});

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider;

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        OpenAIProvider,
        {
          provide: AiConfigService,
          useValue: {
            getOpenAIConfig: jest.fn().mockResolvedValue({
              apiKey: 'sk-test-key',
              baseURL: 'https://api.openai.com/v1',
              defaultModel: 'gpt-4o',
              timeoutMs: 30000,
              maxRetries: 3,
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'OPENAI_API_KEY') return 'sk-test-key';
              if (key === 'OPENAI_DEFAULT_MODEL') return 'gpt-4o';
              return null;
            }),
          },
        },
      ],
    }).compile();

    provider = module.get<OpenAIProvider>(OpenAIProvider);
  });

  it('should initialize successfully with api key', async () => {
    const isHealthy = await provider.healthCheck();
    expect(isHealthy).toBe(true);
  });

  it('should format LLMResponse correctly on chat', async () => {
    const request: LLMRequest = {
      messages: [{ role: 'user', content: 'hello' }],
      model: 'gpt-4-turbo',
    };

    const response = await provider.chat(request);

    expect(response.provider).toBe('openai');
    expect(response.model).toBe('gpt-4-turbo');
    expect(response.content).toBe('This is a mock OpenAI response');
    expect(response.usage.totalTokens).toBe(30);
    expect(response.finishReason).toBe('stop');
  });

  it('should return mock embeddings', async () => {
    const vectors = await provider.embed(['test1', 'test2']);
    expect(vectors).toHaveLength(2);
    expect(vectors[0]).toEqual([0.1, 0.2]);
  });
});
