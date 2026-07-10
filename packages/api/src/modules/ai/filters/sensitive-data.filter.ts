import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SensitiveDataFilter {
  private readonly logger = new Logger(SensitiveDataFilter.name);

  // Simplified regex rules for MVP
  private readonly rules = [
    { name: 'API Key', pattern: /sk-[a-zA-Z0-9]{32,}/g },
    { name: 'JWT', pattern: /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g },
    { name: 'Bearer Token', pattern: /Bearer\s+[a-zA-Z0-9_-]+/g },
  ];

  filter(content: string): string {
    let filteredContent = content;
    let foundSensitiveData = false;

    for (const rule of this.rules) {
      if (rule.pattern.test(filteredContent)) {
        foundSensitiveData = true;
        filteredContent = filteredContent.replace(rule.pattern, `[REDACTED ${rule.name}]`);
      }
    }

    if (foundSensitiveData) {
      this.logger.warn('Sensitive data detected and redacted before sending to LLM.');
      // Audit log should be triggered here ideally (via EventBus or Gateway)
    }

    return filteredContent;
  }
}
