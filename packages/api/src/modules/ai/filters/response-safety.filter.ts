import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class ResponseSafetyFilter {
  private readonly logger = new Logger(ResponseSafetyFilter.name);

  private readonly forbiddenPatterns = [/rm\s+-rf/g, /DROP\s+TABLE/gi];

  filter(content: string): string {
    let filteredContent = content;
    let unsafeContentDetected = false;

    for (const pattern of this.forbiddenPatterns) {
      if (pattern.test(filteredContent)) {
        unsafeContentDetected = true;
        filteredContent = filteredContent.replace(pattern, '[REDACTED UNSAFE CONTENT]');
      }
    }

    if (unsafeContentDetected) {
      this.logger.warn('Unsafe content detected in LLM response and redacted.');
      // Audit log should be triggered here ideally
    }

    return filteredContent;
  }
}
