import { Injectable } from '@nestjs/common';
import { IMatcher, Rule, RuleType, IActionExecutor, MatchResult, RuleAction } from '../interfaces';

@Injectable()
export class KeywordMatcher implements IMatcher {
  public readonly type: RuleType = 'KEYWORD';

  match(content: string, rule: Rule, executors: Map<RuleAction, IActionExecutor>): MatchResult {
    let safeContent = content;
    let matched = false;
    const triggeredRules: Rule[] = [];

    const executor = executors.get(rule.action);
    if (!executor) {
      return { matched, content: safeContent, triggeredRules };
    }

    if (content.includes(rule.pattern)) {
      matched = true;
      triggeredRules.push(rule);

      const escapedPattern = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedPattern, 'g');

      try {
        safeContent = content.replace(regex, (match) => {
          return executor.execute(safeContent, match, rule);
        });
      } catch (e) {
        if (e instanceof Error && e.name === 'BadRequestException') {
          throw e;
        }
      }
    }

    return {
      matched,
      content: safeContent,
      triggeredRules,
    };
  }
}
