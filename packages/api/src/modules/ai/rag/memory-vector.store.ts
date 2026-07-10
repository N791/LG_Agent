import { Injectable } from '@nestjs/common';
import { DocumentChunk } from './markdown-chunker';

interface VectorEntry {
  chunk: DocumentChunk;
  vector: number[];
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

@Injectable()
export class MemoryVectorStore {
  private readonly store: VectorEntry[] = [];

  addDocuments(chunks: DocumentChunk[], vectors: number[][]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new Error('Mismatch between chunks and vectors length');
    }

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = vectors[i];
      if (!chunk || !vector) continue;
      this.store.push({
        chunk,
        vector,
      });
    }
    return Promise.resolve();
  }

  search(queryVector: number[], topK = 3): Promise<SearchResult[]> {
    const results = this.store.map((entry) => ({
      chunk: entry.chunk,
      score: this.cosineSimilarity(queryVector, entry.vector),
    }));

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return Promise.resolve(results.slice(0, topK));
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      const a = vecA[i];
      const b = vecB[i];
      if (a === undefined || b === undefined) break;
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // For testing purposes
  clear(): void {
    this.store.length = 0;
  }
}
