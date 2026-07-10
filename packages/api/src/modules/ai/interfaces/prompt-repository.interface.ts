export interface PromptTemplate {
  id: string;
  system: string;
  user: string;
  description?: string;
}

export interface IPromptRepository {
  getTemplate(id: string): Promise<PromptTemplate>;
}
