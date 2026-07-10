import { Injectable } from '@nestjs/common';
import { IActionExecutor, Rule, RuleAction } from '../interfaces';

@Injectable()
export class MaskActionExecutor implements IActionExecutor {
  public readonly action: RuleAction = 'MASK';

  execute(_content: string, _match: string, rule: Rule): string {
    return rule.replacement ?? `[REDACTED ${rule.name}]`;
  }
}
