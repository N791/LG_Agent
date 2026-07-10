import { Injectable } from '@nestjs/common';
import { IMatcher, Rule, RuleType, IActionExecutor, MatchResult, RuleAction } from '../interfaces';

@Injectable()
export class RegexMatcher implements IMatcher {
  public readonly type: RuleType = 'REGEX';

  match(content: string, rule: Rule, executors: Map<RuleAction, IActionExecutor>): MatchResult {
    let safeContent = content;
    let matched = false;
    const triggeredRules: Rule[] = [];

    const executor = executors.get(rule.action);
    if (!executor) {
      return { matched, content: safeContent, triggeredRules };
    }

    try {
      const regex = new RegExp(rule.pattern, 'g');
      if (regex.test(content)) {
        matched = true;
        triggeredRules.push(rule);

        regex.lastIndex = 0;

        safeContent = content.replace(regex, (match) => {
          return executor.execute(safeContent, match, rule);
        });
      }
    } catch (e) {
      // Allow the error from BLOCK to propagate
      if (e instanceof Error && e.name === 'BadRequestException') {
        throw e;
      }
      // Otherwise ignore invalid regex
    }

    return {
      matched,
      content: safeContent,
      triggeredRules,
    };
  }
}
