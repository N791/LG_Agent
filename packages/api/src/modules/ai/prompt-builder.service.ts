import { Injectable, Inject } from '@nestjs/common';
import type { IPromptRepository } from './interfaces/prompt-repository.interface';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class PromptBuilderService {
  constructor(
    @Inject('IPromptRepository')
    private readonly promptRepository: IPromptRepository,
  ) {}

  /**
   * Compiles a string template by replacing {{key}} with values from variables.
   */
  public compile(template: string, variables: Record<string, string>): string {
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match: string, key: string) => {
      return variables[key] ?? match;
    });
  }

  /**
   * Assembles a structured message array for LLM Gateway consumption.
   */
  public async assembleMessages(
    templateId: string,
    variables: Record<string, string>,
  ): Promise<PromptMessage[]> {
    const template = await this.promptRepository.getTemplate(templateId);

    const systemContent = this.compile(template.system, variables);
    const userContent = this.compile(template.user, variables);

    const messages: PromptMessage[] = [];
    if (systemContent.trim()) {
      messages.push({ role: 'system', content: systemContent });
    }
    if (userContent.trim()) {
      messages.push({ role: 'user', content: userContent });
    }

    return messages;
  }
}
