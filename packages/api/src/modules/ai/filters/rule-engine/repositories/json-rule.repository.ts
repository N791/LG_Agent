import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Rule, IFilterRuleRepository, RuleScope } from '../interfaces';

@Injectable()
export class JsonFilterRuleRepository implements IFilterRuleRepository {
  private readonly logger = new Logger(JsonFilterRuleRepository.name);
  private rules: Rule[] = [];

  constructor() {
    this.loadRules();
  }

  private loadRules() {
    const rulesDir = path.resolve(process.cwd(), 'rules');

    if (!fs.existsSync(rulesDir)) {
      this.logger.warn(`Rules directory not found at ${rulesDir}`);
      return;
    }

    const ruleFiles = [
      'regex.json',
      'keywords.json',
      'mask.json',
      'safety.json',
      'prompt-injection.json',
    ];

    for (const file of ruleFiles) {
      const filePath = path.join(rulesDir, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsedRules = JSON.parse(content) as Rule[];
          this.rules.push(...parsedRules);
        } catch (error: unknown) {
          const err = error as Error;
          this.logger.error(`Failed to load rules from ${filePath}: ${err.message}`);
        }
      }
    }

    // Sort by priority descending
    this.rules.sort((a, b) => b.priority - a.priority);
    this.logger.log(`Loaded ${String(this.rules.length)} filter rules.`);
  }

  getRules(scope: RuleScope): Promise<Rule[]> {
    return Promise.resolve(this.rules.filter((rule) => rule.scope === scope));
  }
}
