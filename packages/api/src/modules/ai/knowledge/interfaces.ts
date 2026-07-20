import { KnowledgeDocumentDTO } from '@lg-agent/contracts';

export interface IKnowledgeRepository {
  getDocuments(): Promise<KnowledgeDocumentDTO[]>;
  getDocument(id: string): Promise<KnowledgeDocumentDTO | null>;
}
