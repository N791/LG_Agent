import { Injectable, Logger } from '@nestjs/common';
import { ContentFilterEngine } from './rule-engine/rule-engine.service';
import type { Rule } from './rule-engine/interfaces';

export interface FilterResult {
  content: string;
  ruleHits: Pick<Rule, 'id' | 'name' | 'action'>[];
}

@Injectable()
export class SensitiveDataFilter {
  private readonly logger = new Logger(SensitiveDataFilter.name);

  constructor(private readonly ruleEngine: ContentFilterEngine) {}

  async filter(content: string): Promise<string> {
    return (await this.filterWithMetadata(content)).content;
  }

  async filterWithMetadata(content: string): Promise<FilterResult> {
    const result = await this.ruleEngine.process(content, 'request');

    if (result.triggeredRules.length > 0) {
      const triggeredNames = result.triggeredRules.map((r) => r.name).join(', ');
      this.logger.warn(`Sensitive data detected and redacted. Triggered rules: ${triggeredNames}`);
    }

    return {
      content: result.safeContent,
      ruleHits: result.triggeredRules.map(({ id, name, action }) => ({ id, name, action })),
    };
  }
}
