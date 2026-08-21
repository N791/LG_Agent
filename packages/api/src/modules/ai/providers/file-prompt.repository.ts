import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IPromptRepository, PromptTemplate } from '../interfaces/prompt-repository.interface';
import * as fs from 'fs';
import * as path from 'path';
import Ajv, { ValidateFunction } from 'ajv';

@Injectable()
export class FilePromptRepository implements IPromptRepository {
  private readonly logger = new Logger(FilePromptRepository.name);
  private readonly templates = new Map<string, PromptTemplate>();
  private readonly ajv = new Ajv({ allErrors: true, strict: false });
  private readonly validateTemplate: ValidateFunction;

  constructor() {
    this.validateTemplate = this.ajv.compile({
      type: 'object',
      additionalProperties: false,
      required: ['id', 'version', 'purpose', 'description', 'system', 'user', 'inputSchema'],
      properties: {
        id: { type: 'string', minLength: 1 },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        purpose: {
          enum: ['tutor', 'code-review', 'ai-review', 'task-generation'],
        },
        description: { type: 'string', minLength: 1 },
        system: { type: 'string' },
        user: { type: 'string' },
        inputSchema: { type: 'object' },
        outputSchema: { type: 'object' },
      },
    });
    this.loadTemplates();
  }

  private loadTemplates() {
    const templatesPath = this.resolveTemplatesPath();
    try {
      const files = fs.readdirSync(templatesPath).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(templatesPath, file), 'utf8');
        const candidate: unknown = JSON.parse(content);
        if (!this.validateTemplate(candidate)) {
          throw new Error(
            `Invalid prompt template ${file}: ${new Ajv().errorsText(this.validateTemplate.errors)}`,
          );
        }
        const template = candidate as PromptTemplate;
        this.ajv.compile(template.inputSchema);
        if (template.outputSchema) this.ajv.compile(template.outputSchema);
        if (this.templates.has(template.id)) {
          throw new Error(`Duplicate prompt template id: ${template.id}`);
        }
        this.templates.set(template.id, template);
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to load prompt templates: ${(error as Error).message}`);
      throw error;
    }
  }

  private resolveTemplatesPath(): string {
    const candidates = [
      path.join(__dirname, '../templates'),
      path.join(process.cwd(), 'packages/api/src/modules/ai/templates'),
      path.join(process.cwd(), 'src/modules/ai/templates'),
    ];
    const templatesPath = candidates.find((candidate) => fs.existsSync(candidate));
    if (!templatesPath) {
      throw new Error(`Prompt template directory not found. Checked: ${candidates.join(', ')}`);
    }
    return templatesPath;
  }

  getTemplate(id: string): Promise<PromptTemplate> {
    const template = this.templates.get(id);
    if (!template) {
      return Promise.reject(
        new NotFoundException({ message: 'errors.ai.promptNotFound', args: { id } }),
      );
    }
    return Promise.resolve(template);
  }

  listTemplates(): Promise<PromptTemplate[]> {
    return Promise.resolve([...this.templates.values()]);
  }
}
