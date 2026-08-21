export type PromptPurpose = 'tutor' | 'code-review' | 'ai-review' | 'task-generation';

export type PromptJsonSchema = Record<string, unknown>;

export interface PromptTemplate {
  id: string;
  version: string;
  purpose: PromptPurpose;
  system: string;
  user: string;
  description: string;
  inputSchema: PromptJsonSchema;
  outputSchema?: PromptJsonSchema;
}

export interface IPromptRepository {
  getTemplate(id: string): Promise<PromptTemplate>;
  listTemplates(): Promise<PromptTemplate[]>;
}
