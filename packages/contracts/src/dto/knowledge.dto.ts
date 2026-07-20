export interface KnowledgeDocumentDTO {
  id: string;
  title: string;
  content: string;
  source: string;
}

export interface KnowledgeSearchResultDTO {
  chunkContent: string;
  source: string;
  score: number;
}
