import { Injectable, Logger } from '@nestjs/common';
import { ContentFilterEngine } from './rule-engine/rule-engine.service';

@Injectable()
export class ResponseSafetyFilter {
  private readonly logger = new Logger(ResponseSafetyFilter.name);

  constructor(private readonly filterEngine: ContentFilterEngine) {}

  async filterComplete(content: string): Promise<string> {
    const result = await this.filterEngine.process(content, 'response');

    if (result.triggeredRules.length > 0) {
      const triggeredNames = result.triggeredRules.map((r) => r.name).join(', ');
      this.logger.warn(`Unsafe content detected and handled. Triggered rules: ${triggeredNames}`);
      // Audit log should be triggered here ideally
    }

    return result.safeContent;
  }

  filterChunk(chunk: string): Promise<string> {
    // For MVP, we pass chunks through directly or apply basic filtering.
    // Full streaming safety requires a buffering mechanism in the future.
    return Promise.resolve(chunk);
  }
}
