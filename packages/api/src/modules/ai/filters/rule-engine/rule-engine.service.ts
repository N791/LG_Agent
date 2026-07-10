import { Injectable, Inject, Logger } from '@nestjs/common';
import type { Rule, IFilterRuleRepository, IMatcher, IActionExecutor } from './interfaces';
import { RuleType, RuleAction, RuleScope } from './interfaces';

@Injectable()
export class ContentFilterEngine {
  private readonly logger = new Logger(ContentFilterEngine.name);
  private readonly matchers = new Map<RuleType, IMatcher>();
  private readonly executors = new Map<RuleAction, IActionExecutor>();

  constructor(
    @Inject('IFilterRuleRepository') private readonly ruleRepository: IFilterRuleRepository,
    @Inject('IMatchers') matchers: IMatcher[],
    @Inject('IActionExecutors') executors: IActionExecutor[],
  ) {
    for (const matcher of matchers) {
      this.matchers.set(matcher.type, matcher);
    }
    for (const executor of executors) {
      this.executors.set(executor.action, executor);
    }
  }

  async process(
    content: string,
    scope: RuleScope,
  ): Promise<{ safeContent: string; triggeredRules: Rule[] }> {
    let currentContent = content;
    const triggeredRules: Rule[] = [];

    // Get all rules from repository for the given scope
    const rules = await this.ruleRepository.getRules(scope);

    for (const rule of rules) {
      if (!rule.enabled) continue;

      const matcher = this.matchers.get(rule.type);
      if (!matcher) {
        this.logger.warn(`No matcher found for rule type: ${rule.type}`);
        continue;
      }

      const result = matcher.match(currentContent, rule, this.executors);
      if (result.matched) {
        currentContent = result.content;
        triggeredRules.push(...result.triggeredRules);
      }
    }

    return {
      safeContent: currentContent,
      triggeredRules,
    };
  }
}
