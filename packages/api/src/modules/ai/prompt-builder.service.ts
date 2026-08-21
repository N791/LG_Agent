import { Injectable, Inject } from '@nestjs/common';
import type { IPromptRepository } from './interfaces/prompt-repository.interface';
import Ajv, { ValidateFunction } from 'ajv';

export interface PromptMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class PromptBuilderService {
  private readonly ajv = new Ajv({ allErrors: true, strict: false });
  private readonly validators = new Map<string, ValidateFunction>();

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
    this.assertValid(`${template.id}@${template.version}:input`, template.inputSchema, variables);

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

  public async validateOutput(templateId: string, output: unknown): Promise<void> {
    const template = await this.promptRepository.getTemplate(templateId);
    if (!template.outputSchema) return;
    this.assertValid(`${template.id}@${template.version}:output`, template.outputSchema, output);
  }

  private assertValid(key: string, schema: Record<string, unknown>, value: unknown): void {
    let validate = this.validators.get(key);
    if (!validate) {
      validate = this.ajv.compile(schema);
      this.validators.set(key, validate);
    }
    if (!validate(value)) {
      throw new Error(
        `Prompt schema validation failed for ${key}: ${this.ajv.errorsText(validate.errors)}`,
      );
    }
  }
}
