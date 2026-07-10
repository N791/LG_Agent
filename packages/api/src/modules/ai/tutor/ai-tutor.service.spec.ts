import { Test, TestingModule } from '@nestjs/testing';
import { AiTutorService } from './ai-tutor.service';
import { AskStrategy } from './strategies/ask.strategy';
import { CodeReviewStrategy } from './strategies/code-review.strategy';
import { ExplainErrorStrategy } from './strategies/explain-error.strategy';
import { LLMGatewayService } from '../gateway/llm-gateway.service';
import { PromptBuilderService } from '../prompt-builder.service';
import { RagService } from '../rag/rag.service';
import { LLMResponse } from '../interfaces/llm-provider.interface';

describe('AiTutorService', () => {
  let service: AiTutorService;
  let mockGateway: Partial<LLMGatewayService>;

  beforeEach(async () => {
    mockGateway = {
      chat: jest.fn().mockResolvedValue({
        content: 'Mocked Response',
        provider: 'mock',
        model: 'mock-model',
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
        finishReason: 'stop',
      }),
      stream: jest.fn(),
    };

    const mockPromptBuilder = {
      assembleMessages: jest.fn().mockResolvedValue([{ role: 'user', content: 'test' }]),
    };

    const mockRagService = {
      search: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiTutorService,
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
        { provide: LLMGatewayService, useValue: mockGateway },
        { provide: PromptBuilderService, useValue: mockPromptBuilder },
        { provide: RagService, useValue: mockRagService },
      ],
    }).compile();

    service = module.get<AiTutorService>(AiTutorService);
  });

  it('should route ask action to AskStrategy and call gateway', async () => {
    const result = (await service.chat({ action: 'ask', content: 'Hello' })) as LLMResponse;

    expect(result.content).toBe('Mocked Response');
    expect(mockGateway.chat).toHaveBeenCalled();
  });

  it('should route code_review action to CodeReviewStrategy', async () => {
    const result = (await service.chat({
      action: 'code_review',
      content: 'const a = 1;',
    })) as LLMResponse;

    expect(result.content).toBe('Mocked Response');
    expect(mockGateway.chat).toHaveBeenCalled();
  });

  it('should throw NotFoundException for unknown action', async () => {
    await expect(service.chat({ action: 'unknown_action', content: 'test' })).rejects.toThrow(
      'No tutor strategy found for action: unknown_action',
    );
  });
});
