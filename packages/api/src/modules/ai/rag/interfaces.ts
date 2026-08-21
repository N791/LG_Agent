import { DocumentChunk } from './markdown-chunker';

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

export interface IVectorStore {
  addDocuments(chunks: DocumentChunk[], vectors: number[][]): Promise<void>;
  search(queryVector: number[], topK?: number): Promise<SearchResult[]>;
  deleteBySource(source: string): Promise<void>;
  reset(): Promise<void>;
}

export const VECTOR_STORE = Symbol('VECTOR_STORE');
