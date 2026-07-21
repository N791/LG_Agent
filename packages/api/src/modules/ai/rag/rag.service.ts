import { Injectable, Logger } from '@nestjs/common';
import { MarkdownChunker } from './markdown-chunker';
import { MemoryVectorStore } from './memory-vector.store';
import { SearchResult } from './interfaces';
import { LLMGatewayService } from '../gateway/llm-gateway.service';
import { AiConfigService } from '../ai-config.service';

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);

  constructor(
    private readonly chunker: MarkdownChunker,
    private readonly vectorStore: MemoryVectorStore,
    private readonly gateway: LLMGatewayService,
    private readonly aiConfig: AiConfigService,
  ) {}

  async importDocument(text: string, source: string): Promise<number> {
    this.logger.log(`Importing document from source: ${source}`);

    // 1. Chunk text
    const config = await this.aiConfig.getRagConfig();
    const chunks = this.chunker.chunkText(text, { source }, { chunkSize: config.chunkSize });
    if (chunks.length === 0) return 0;

    // 2. Generate Embeddings via Gateway
    const textsToEmbed = chunks.map((c) => c.content);
    const vectors = await this.gateway.embed(textsToEmbed);

    // 3. Store in Vector Database
    await this.vectorStore.addDocuments(chunks, vectors);

    this.logger.log(`Successfully indexed ${String(chunks.length)} chunks from ${source}`);
    return chunks.length;
  }

  async search(query: string, topK?: number): Promise<SearchResult[]> {
    const config = await this.aiConfig.getRagConfig();
    if (!config.enabled) {
      return [];
    }

    const effectiveTopK = topK ?? config.topK;

    // 1. Embed query
    const queryVectors = await this.gateway.embed([query]);
    if (queryVectors.length === 0) {
      return [];
    }

    const firstQueryVector = queryVectors[0];
    if (!firstQueryVector) return [];

    // 2. Search Vector Database
    return this.vectorStore.search(firstQueryVector, effectiveTopK);
  }
}
