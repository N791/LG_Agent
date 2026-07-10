import { Injectable, NotFoundException } from '@nestjs/common';
import { IPromptRepository, PromptTemplate } from '../interfaces/prompt-repository.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FilePromptRepository implements IPromptRepository {
  private templates = new Map<string, PromptTemplate>();

  constructor() {
    this.loadTemplates();
  }

  private loadTemplates() {
    try {
      const templatesPath = path.join(process.cwd(), 'src/modules/ai/templates');
      if (!fs.existsSync(templatesPath)) {
        fs.mkdirSync(templatesPath, { recursive: true });

        // MVP: Create a default CODE_REVIEW template
        const defaultTemplate: PromptTemplate = {
          id: 'CODE_REVIEW',
          description: 'AI Code Review Template',
          system:
            'You are an expert code reviewer. Please review the following code and provide constructive feedback.',
          user: 'Task Description: {{task_description}}\n\nUser Code:\n```javascript\n{{code}}\n```',
        };
        fs.writeFileSync(
          path.join(templatesPath, 'CODE_REVIEW.json'),
          JSON.stringify(defaultTemplate, null, 2),
        );
      }

      const files = fs.readdirSync(templatesPath).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        const content = fs.readFileSync(path.join(templatesPath, file), 'utf8');
        const template = JSON.parse(content) as unknown as PromptTemplate;
        this.templates.set(template.id, template);
      }
    } catch (error: unknown) {
      const err = error as Error;
      console.error(`Failed to load prompt templates: ${err.message}`);
    }
  }

  getTemplate(id: string): Promise<PromptTemplate> {
    const template = this.templates.get(id);
    if (!template) {
      return Promise.reject(new NotFoundException(`Prompt template ${id} not found`));
    }
    return Promise.resolve(template);
  }
}
