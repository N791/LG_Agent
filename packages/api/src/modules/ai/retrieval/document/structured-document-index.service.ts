import { Inject, Injectable, Optional } from '@nestjs/common';
import type {
  ChunkingOptions,
  DocumentStructureNode,
  StructuredDocumentChunk,
} from './document-structure.types';
import { DocumentStructureParser } from './document-structure.parser';
import { StructuredDocumentChunker } from './structured-document.chunker';
import { IndexJobObservabilityService } from '../index-job-observability.service';

export interface DocumentIndexInput {
  organizationId: string;
  documentVersionId: string;
  markdown: string;
  options?: ChunkingOptions;
}

export interface DocumentIndexResult {
  documentVersionId: string;
  nodeCount: number;
  chunkCount: number;
  reused: boolean;
}

export interface IDocumentIndexRepository {
  isReady(
    organizationId: string,
    documentVersionId: string,
    chunkerVersion: string,
  ): Promise<boolean>;
  replaceBuildingIndex(input: {
    organizationId: string;
    documentVersionId: string;
    chunkerVersion: string;
    nodes: DocumentStructureNode[];
    chunks: StructuredDocumentChunk[];
    embeddings: number[][];
  }): Promise<void>;
  markReady(
    organizationId: string,
    documentVersionId: string,
    chunkerVersion: string,
  ): Promise<void>;
  markFailed(organizationId: string, documentVersionId: string, reason: string): Promise<void>;
}

export interface IDocumentEmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
}

export const DOCUMENT_INDEX_REPOSITORY = Symbol('IDocumentIndexRepository');
export const DOCUMENT_EMBEDDING_PROVIDER = Symbol('IDocumentEmbeddingProvider');

@Injectable()
export class StructuredDocumentIndexService {
  constructor(
    private readonly parser: DocumentStructureParser,
    private readonly chunker: StructuredDocumentChunker,
    @Inject(DOCUMENT_INDEX_REPOSITORY) private readonly repository: IDocumentIndexRepository,
    @Inject(DOCUMENT_EMBEDDING_PROVIDER) private readonly embeddings: IDocumentEmbeddingProvider,
    @Optional() private readonly jobs?: IndexJobObservabilityService,
  ) {}

  async index(input: DocumentIndexInput): Promise<DocumentIndexResult> {
    const chunkerVersion = input.options?.chunkerVersion ?? 'structured-markdown-v1';
    if (
      await this.repository.isReady(input.organizationId, input.documentVersionId, chunkerVersion)
    ) {
      return {
        documentVersionId: input.documentVersionId,
        nodeCount: 0,
        chunkCount: 0,
        reused: true,
      };
    }
    this.jobs?.start({
      jobId: input.documentVersionId,
      organizationId: input.organizationId,
      kind: 'DOCUMENT',
      indexVersion: chunkerVersion,
      content: input.markdown,
    });

    const document = this.parser.parse(input.markdown, input.documentVersionId);
    const chunks = this.chunker.chunk(document, { ...input.options, chunkerVersion });
    const nodes = this.flatten(document.root);
    this.jobs?.progress(input.documentVersionId, 25);
    try {
      const vectors = chunks.length
        ? await this.embeddings.embed(chunks.map(({ content }) => content))
        : [];
      if (vectors.length !== chunks.length) {
        throw new Error('Embedding provider returned a different number of vectors than chunks.');
      }
      this.jobs?.progress(input.documentVersionId, 65);
      await this.repository.replaceBuildingIndex({
        organizationId: input.organizationId,
        documentVersionId: input.documentVersionId,
        chunkerVersion,
        nodes,
        chunks,
        embeddings: vectors,
      });
      await this.repository.markReady(
        input.organizationId,
        input.documentVersionId,
        chunkerVersion,
      );
      this.jobs?.complete(input.documentVersionId);
      return {
        documentVersionId: input.documentVersionId,
        nodeCount: nodes.length,
        chunkCount: chunks.length,
        reused: false,
      };
    } catch (error: unknown) {
      this.jobs?.fail(input.documentVersionId, error);
      await this.repository.markFailed(
        input.organizationId,
        input.documentVersionId,
        (error as Error).message.slice(0, 500),
      );
      throw error;
    }
  }

  private flatten(root: DocumentStructureNode): DocumentStructureNode[] {
    return [root, ...root.children.flatMap((child) => this.flatten(child))];
  }
}
