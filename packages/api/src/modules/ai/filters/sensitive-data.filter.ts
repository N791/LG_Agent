import { Injectable, Logger } from '@nestjs/common';
import { ContentFilterEngine } from './rule-engine/rule-engine.service';

@Injectable()
export class SensitiveDataFilter {
  private readonly logger = new Logger(SensitiveDataFilter.name);

  constructor(private readonly ruleEngine: ContentFilterEngine) {}

  async filter(content: string): Promise<string> {
    const result = await this.ruleEngine.process(content, 'request');

    if (result.triggeredRules.length > 0) {
      const triggeredNames = result.triggeredRules.map((r) => r.name).join(', ');
      this.logger.warn(`Sensitive data detected and redacted. Triggered rules: ${triggeredNames}`);
      // Audit log should be triggered here ideally (via EventBus or Gateway)
    }

    return result.safeContent;
  }
}
