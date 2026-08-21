import { Injectable } from '@nestjs/common';
import type {
  ChunkingOptions,
  DocumentStructureNode,
  StructuredDocument,
  StructuredDocumentChunk,
} from './document-structure.types';
import { contentHash, stableRetrievalId } from './stable-id';

const DEFAULT_CHUNKER_VERSION = 'structured-markdown-v1';

@Injectable()
export class StructuredDocumentChunker {
  chunk(document: StructuredDocument, options: ChunkingOptions = {}): StructuredDocumentChunk[] {
    const maxTokens = Math.max(16, options.maxTokens ?? 400);
    const overlapTokens = Math.min(
      maxTokens - 1,
      Math.max(0, options.overlapTokens ?? Math.floor(maxTokens * 0.1)),
    );
    const chunkerVersion = options.chunkerVersion ?? DEFAULT_CHUNKER_VERSION;
    const chunks: StructuredDocumentChunk[] = [];

    this.walk(document.root, (node) => {
      if (!node.content.trim()) return;
      const tokens = this.tokenize(node.content);
      const step = maxTokens - overlapTokens;
      for (let offset = 0, ordinal = 0; offset < tokens.length; offset += step, ordinal += 1) {
        const window = tokens.slice(offset, offset + maxTokens);
        const content = window.join('');
        const hash = contentHash(content);
        chunks.push({
          id: stableRetrievalId(
            'document-chunk',
            document.documentVersionId,
            chunkerVersion,
            node.id,
            ordinal,
            hash,
          ),
          documentVersionId: document.documentVersionId,
          nodeId: node.id,
          ...(node.parentId && { parentId: node.parentId }),
          content,
          contentHash: hash,
          sectionPath: node.sectionPath,
          ordinal,
          tokenCount: window.length,
          locator: node.locator,
          chunkerVersion,
        });
        if (offset + maxTokens >= tokens.length) break;
      }
    });
    return chunks;
  }

  private walk(node: DocumentStructureNode, visit: (node: DocumentStructureNode) => void): void {
    visit(node);
    node.children.forEach((child) => {
      this.walk(child, visit);
    });
  }

  // Keeps whitespace attached so joining a window does not corrupt source text or mixed languages.
  private tokenize(content: string): string[] {
    return content.match(/[\p{Script=Han}]|[^\S\n]+|\n|[\p{Letter}\p{Number}_]+|[^\s]/gu) ?? [];
  }
}
