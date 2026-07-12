import { Injectable, Logger } from '@nestjs/common';
import { ContentFilterEngine } from './rule-engine/rule-engine.service';
import { PrismaService } from '../../../common/prisma.service';

@Injectable()
export class ResponseSafetyFilter {
  private readonly logger = new Logger(ResponseSafetyFilter.name);

  constructor(
    private readonly filterEngine: ContentFilterEngine,
    private readonly prisma: PrismaService,
  ) {}

  async filterComplete(content: string): Promise<string> {
    const result = await this.filterEngine.process(content, 'response');

    if (result.triggeredRules.length > 0) {
      const triggeredNames = result.triggeredRules.map((r) => r.name).join(', ');
      this.logger.warn(`Unsafe content detected and handled. Triggered rules: ${triggeredNames}`);
      
      for (const rule of result.triggeredRules) {
        await this.prisma.llmAuditLog.create({
          data: {
            requestId: Math.random().toString(36).substring(7),
            eventType: 'RESPONSE_SAFETY_VIOLATION',
            severity: 'HIGH',
            action: rule.action,
            message: `Triggered rule: ${rule.name}`,
            metadata: { ruleId: rule.id, pattern: rule.pattern },
          },
        });
      }
    }

    return result.safeContent;
  }

  filterChunk(chunk: string): Promise<string> {
    // For MVP, we pass chunks through directly or apply basic filtering.
    // Full streaming safety requires a buffering mechanism in the future.
    return Promise.resolve(chunk);
  }
}
