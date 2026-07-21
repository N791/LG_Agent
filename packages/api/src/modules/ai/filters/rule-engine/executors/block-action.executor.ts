import { Injectable, BadRequestException } from '@nestjs/common';
import { IActionExecutor, Rule, RuleAction } from '../interfaces';

@Injectable()
export class BlockActionExecutor implements IActionExecutor {
  public readonly action: RuleAction = 'BLOCK';

  execute(_content: string, _match: string, rule: Rule): string {
    throw new BadRequestException({
      message: 'errors.ai.blockedByRule',
      args: { rule: rule.name },
    });
  }
}
