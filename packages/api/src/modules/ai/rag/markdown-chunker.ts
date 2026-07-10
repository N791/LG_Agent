import { Injectable } from '@nestjs/common';

export interface DocumentChunk {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class MarkdownChunker {
  /**
   * Extremely simple chunker for MVP: splits by double newlines (paragraphs).
   * In a real implementation, this would use LangChain's RecursiveCharacterTextSplitter
   * or a custom Markdown AST parser to chunk by headers.
   */
  chunkText(text: string, metadata: Record<string, unknown> = {}): DocumentChunk[] {
    const rawChunks = text.split(/\n\s*\n/);
    const chunks: DocumentChunk[] = [];

    let currentContent = '';
    const MAX_CHUNK_LENGTH = 1000;

    for (const piece of rawChunks) {
      if (!piece.trim()) continue;

      if (currentContent.length + piece.length > MAX_CHUNK_LENGTH && currentContent.length > 0) {
        chunks.push(this.createChunk(currentContent, metadata));
        currentContent = '';
      }
      currentContent += (currentContent ? '\n\n' : '') + piece;
    }

    if (currentContent.trim()) {
      chunks.push(this.createChunk(currentContent, metadata));
    }

    return chunks;
  }

  private createChunk(content: string, metadata: Record<string, unknown>): DocumentChunk {
    return {
      id: Math.random().toString(36).substring(7),
      content: content.trim(),
      metadata,
    };
  }
}
