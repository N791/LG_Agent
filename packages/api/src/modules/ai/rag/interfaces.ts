import { DocumentChunk } from './markdown-chunker';

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

export interface IVectorStore {
  addDocuments(chunks: DocumentChunk[], vectors: number[][]): Promise<void>;
  search(queryVector: number[], topK?: number): Promise<SearchResult[]>;
}
