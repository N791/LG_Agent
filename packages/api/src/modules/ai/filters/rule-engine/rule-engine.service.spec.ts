import { Test, TestingModule } from '@nestjs/testing';
import { ContentFilterEngine } from './rule-engine.service';
import { MaskActionExecutor } from './executors/mask-action.executor';
import { BlockActionExecutor } from './executors/block-action.executor';
import { RegexMatcher } from './matchers/regex.matcher';
import { KeywordMatcher } from './matchers/keyword.matcher';
import { Rule, IFilterRuleRepository } from './interfaces';
import { BadRequestException } from '@nestjs/common';

describe('ContentFilterEngine', () => {
  let filterEngine: ContentFilterEngine;

  const mockRules: Rule[] = [
    {
      id: '1',
      name: 'API Key',
      type: 'REGEX',
      scope: 'request',
      action: 'MASK',
      pattern: 'sk-[a-zA-Z0-9]{32,}',
      replacement: '[REDACTED API KEY]',
      priority: 100,
      enabled: true,
    },
    {
      id: '2',
      name: 'Secret Project',
      type: 'KEYWORD',
      scope: 'request',
      action: 'MASK',
      pattern: 'Project Apollo',
      replacement: '[REDACTED PROJECT]',
      priority: 50,
      enabled: true,
    },
    {
      id: '3',
      name: 'Dangerous Command',
      type: 'REGEX',
      scope: 'response',
      action: 'BLOCK',
      pattern: 'rm\\s+-rf',
      priority: 100,
      enabled: true,
    },
  ];

  beforeEach(async () => {
    const mockRuleRepository: IFilterRuleRepository = {
      getRules: jest.fn().mockImplementation((scope) => {
        return Promise.resolve(mockRules.filter((r) => r.scope === scope));
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContentFilterEngine,
        {
          provide: 'IFilterRuleRepository',
          useValue: mockRuleRepository,
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
      ],
    }).compile();

    filterEngine = module.get<ContentFilterEngine>(ContentFilterEngine);
  });

  it('should redact regex pattern for MASK action', async () => {
    const input = 'Here is my key: sk-123456789012345678901234567890123456';
    const result = await filterEngine.process(input, 'request');

    expect(result.safeContent).toBe('Here is my key: [REDACTED API KEY]');
    expect(result.triggeredRules).toHaveLength(1);
    expect(result.triggeredRules[0]?.name).toBe('API Key');
  });

  it('should redact keyword pattern for MASK action', async () => {
    const input = 'We are working on Project Apollo today.';
    const result = await filterEngine.process(input, 'request');

    expect(result.safeContent).toBe('We are working on [REDACTED PROJECT] today.');
    expect(result.triggeredRules).toHaveLength(1);
    expect(result.triggeredRules[0]?.name).toBe('Secret Project');
  });

  it('should throw BadRequestException for BLOCK action', async () => {
    const input = 'Try running this: rm -rf /';

    await expect(filterEngine.process(input, 'response')).rejects.toThrow(BadRequestException);
  });

  it('should not throw if scope is different', async () => {
    const input = 'Try running this: rm -rf /';

    // scope request does not include the rm -rf block rule
    const result = await filterEngine.process(input, 'request');

    expect(result.safeContent).toBe(input);
    expect(result.triggeredRules).toHaveLength(0);
  });
});
