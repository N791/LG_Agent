import { Test, TestingModule } from '@nestjs/testing';
import { PromptBuilderService } from './prompt-builder.service';
import { IPromptRepository, PromptTemplate } from './interfaces/prompt-repository.interface';

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;
  let mockRepository: jest.Mocked<IPromptRepository>;

  beforeEach(async () => {
    mockRepository = {
      getTemplate: jest.fn(),
      listTemplates: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PromptBuilderService,
        {
          provide: 'IPromptRepository',
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PromptBuilderService>(PromptBuilderService);
  });

  it('should compile template with variables', () => {
    const template = 'Hello {{name}}, welcome to {{ place }}!';
    const variables = { name: 'Alice', place: 'Wonderland' };
    const result = service.compile(template, variables);
    expect(result).toBe('Hello Alice, welcome to Wonderland!');
  });

  it('should ignore undefined variables', () => {
    const template = 'Hello {{name}}, welcome to {{place}}!';
    const variables = { name: 'Alice' }; // place is missing
    const result = service.compile(template, variables);
    expect(result).toBe('Hello Alice, welcome to {{place}}!');
  });

  it('should assemble messages from template', async () => {
    const templateId = 'TEST_TEMPLATE';
    const mockTemplate: PromptTemplate = {
      id: templateId,
      version: '1.0.0',
      purpose: 'tutor',
      description: 'Test prompt',
      inputSchema: { type: 'object' },
      system: 'You are a helpful assistant for {{domain}}.',
      user: 'How do I {{action}} in {{domain}}?',
    };

    mockRepository.getTemplate.mockResolvedValue(mockTemplate);

    const variables = { domain: 'React', action: 'use hooks' };
    const messages = await service.assembleMessages(templateId, variables);

    expect(mockRepository.getTemplate.mock.calls[0]?.[0]).toBe(templateId);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual({
      role: 'system',
      content: 'You are a helpful assistant for React.',
    });
    expect(messages[1]).toEqual({ role: 'user', content: 'How do I use hooks in React?' });
  });

  it('should omit empty messages', async () => {
    const templateId = 'NO_SYSTEM';
    const mockTemplate: PromptTemplate = {
      id: templateId,
      version: '1.0.0',
      purpose: 'tutor',
      description: 'Test prompt',
      inputSchema: { type: 'object' },
      system: '   ', // Empty or whitespace
      user: 'Just user message',
    };

    mockRepository.getTemplate.mockResolvedValue(mockTemplate);

    const messages = await service.assembleMessages(templateId, {});
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe('user');
  });

  it('rejects input that violates the prompt version schema', async () => {
    mockRepository.getTemplate.mockResolvedValue({
      id: 'SCHEMA_INPUT',
      version: '2.0.0',
      purpose: 'tutor',
      description: 'Schema validation fixture',
      system: '',
      user: '{{content}}',
      inputSchema: {
        type: 'object',
        required: ['content'],
        properties: { content: { type: 'string', minLength: 1 } },
      },
    });

    await expect(service.assembleMessages('SCHEMA_INPUT', {})).rejects.toThrow(
      'SCHEMA_INPUT@2.0.0:input',
    );
  });

  it('validates structured model output against the template schema', async () => {
    mockRepository.getTemplate.mockResolvedValue({
      id: 'STRUCTURED',
      version: '1.1.0',
      purpose: 'ai-review',
      description: 'Structured output fixture',
      system: '',
      user: '',
      inputSchema: { type: 'object' },
      outputSchema: {
        type: 'object',
        required: ['summary'],
        properties: { summary: { type: 'string' } },
        additionalProperties: false,
      },
    });

    await expect(service.validateOutput('STRUCTURED', { summary: 'ok' })).resolves.toBeUndefined();
    await expect(service.validateOutput('STRUCTURED', { invalid: true })).rejects.toThrow(
      'STRUCTURED@1.1.0:output',
    );
  });
});
