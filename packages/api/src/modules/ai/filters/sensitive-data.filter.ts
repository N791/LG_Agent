import { Injectable, Logger } from '@nestjs/common';
import { ContentFilterEngine } from './rule-engine/rule-engine.service';
import { PrismaService } from '../../../common/prisma.service';

@Injectable()
export class SensitiveDataFilter {
  private readonly logger = new Logger(SensitiveDataFilter.name);

  constructor(
    private readonly ruleEngine: ContentFilterEngine,
    private readonly prisma: PrismaService,
  ) {}

  async filter(content: string): Promise<string> {
    const result = await this.ruleEngine.process(content, 'request');

    if (result.triggeredRules.length > 0) {
      const triggeredNames = result.triggeredRules.map((r) => r.name).join(', ');
      this.logger.warn(`Sensitive data detected and redacted. Triggered rules: ${triggeredNames}`);
      
      for (const rule of result.triggeredRules) {
        await this.prisma.llmAuditLog.create({
          data: {
            requestId: Math.random().toString(36).substring(7),
            eventType: 'REQUEST_SENSITIVE_DATA',
            severity: 'MEDIUM',
            action: rule.action,
            message: `Triggered rule: ${rule.name}`,
            metadata: { ruleId: rule.id, pattern: rule.pattern },
          },
        });
      }
    }

    return result.safeContent;
  }
}
