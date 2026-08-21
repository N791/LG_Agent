import Ajv from 'ajv';
import { FilePromptRepository } from './file-prompt.repository';

describe('FilePromptRepository contract', () => {
  it('loads only versioned, purpose-scoped templates with valid schemas', async () => {
    const repository = new FilePromptRepository();
    const templates = await repository.listTemplates();

    expect(templates.map((template) => template.id)).toEqual(
      expect.arrayContaining(['chat', 'hint', 'explain_error', 'code_review', 'ask', 'ai_review']),
    );
    for (const template of templates) {
      expect(template.version).toMatch(/^\d+\.\d+\.\d+$/);
      expect(template.purpose).toBeTruthy();
      expect(() => new Ajv({ strict: false }).compile(template.inputSchema)).not.toThrow();
      const outputSchema = template.outputSchema;
      if (outputSchema) {
        expect(() => new Ajv({ strict: false }).compile(outputSchema)).not.toThrow();
      }
    }
  });
});
