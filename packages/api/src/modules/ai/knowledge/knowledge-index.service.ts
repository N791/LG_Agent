/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions */
import { Injectable, Logger } from '@nestjs/common';
import { MarkdownKnowledgeRepository } from './markdown-knowledge.repository';
import { RagService } from '../rag/rag.service';

@Injectable()
export class KnowledgeIndexService {
  private readonly logger = new Logger(KnowledgeIndexService.name);

  constructor(
    private readonly knowledgeRepo: MarkdownKnowledgeRepository,
    private readonly ragService: RagService,
  ) {}

  async buildIndex() {
    this.logger.log('Building Knowledge Index from repository...');
    const documents = await this.knowledgeRepo.getDocuments();

    let totalChunks = 0;
    for (const doc of documents) {
      try {
        const chunks = await this.ragService.importDocument(doc.content, doc.id);
        totalChunks += chunks;
      } catch (err: any) {
        this.logger.error(`Failed to index document ${doc.id}: ${err.message}`);
      }
    }

    this.logger.log(`Knowledge Index built successfully. Total indexed chunks: ${String(totalChunks)}`);
  }
}
