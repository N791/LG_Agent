import { KnowledgeDocumentDTO, KnowledgeSearchResultDTO } from '@lg-agent/contracts';
import request from '../utils/request';

export const knowledgeService = {
  async getDocuments(): Promise<KnowledgeDocumentDTO[]> {
    const res = await request.get<{ data?: KnowledgeDocumentDTO[] } | KnowledgeDocumentDTO[]>('/ai/knowledge');
    return (res as unknown as { data?: KnowledgeDocumentDTO[] })?.data ?? (res as unknown as KnowledgeDocumentDTO[]) ?? [];
  },

  async getDocument(id: string): Promise<KnowledgeDocumentDTO> {
    const res = await request.get<{ data?: KnowledgeDocumentDTO } | KnowledgeDocumentDTO>(`/ai/knowledge/${id}`);
    return (res as unknown as { data?: KnowledgeDocumentDTO })?.data ?? (res as unknown as KnowledgeDocumentDTO);
  },

  async search(query: string): Promise<KnowledgeSearchResultDTO[]> {
    const res = await request.get<{ data?: KnowledgeSearchResultDTO[] } | KnowledgeSearchResultDTO[]>('/ai/knowledge/search', {
      params: { q: query },
    });
    return (res as unknown as { data?: KnowledgeSearchResultDTO[] })?.data ?? (res as unknown as KnowledgeSearchResultDTO[]) ?? [];
  },
};
