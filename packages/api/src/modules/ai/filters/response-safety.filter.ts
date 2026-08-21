import { Injectable, Logger } from '@nestjs/common';
import { ContentFilterEngine } from './rule-engine/rule-engine.service';
import type { FilterResult } from './sensitive-data.filter';

@Injectable()
export class ResponseSafetyFilter {
  private readonly logger = new Logger(ResponseSafetyFilter.name);

  constructor(private readonly filterEngine: ContentFilterEngine) {}

  async filterComplete(content: string): Promise<string> {
    return (await this.filterCompleteWithMetadata(content)).content;
  }

  async filterCompleteWithMetadata(content: string): Promise<FilterResult> {
    const result = await this.filterEngine.process(content, 'response');

    if (result.triggeredRules.length > 0) {
      const triggeredNames = result.triggeredRules.map((r) => r.name).join(', ');
      this.logger.warn(`Unsafe content detected and handled. Triggered rules: ${triggeredNames}`);
    }

    return {
      content: result.safeContent,
      ruleHits: result.triggeredRules.map(({ id, name, action }) => ({ id, name, action })),
    };
  }

  async filterChunk(chunk: string): Promise<string> {
    return (await this.filterChunkWithMetadata(chunk)).content;
  }

  async filterChunkWithMetadata(chunk: string): Promise<FilterResult> {
    const result = await this.filterEngine.process(chunk, 'response');
    return {
      content: result.safeContent,
      ruleHits: result.triggeredRules.map(({ id, name, action }) => ({ id, name, action })),
    };
  }
}
