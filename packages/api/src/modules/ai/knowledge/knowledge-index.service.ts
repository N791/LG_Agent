import { Injectable, Logger } from '@nestjs/common';
import { MarkdownKnowledgeRepository } from './markdown-knowledge.repository';
import { RagService } from '../rag/rag.service';

export type KnowledgeIndexState = 'idle' | 'building' | 'ready' | 'degraded';

export interface KnowledgeIndexStatus {
  state: KnowledgeIndexState;
  indexedChunks: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

@Injectable()
export class KnowledgeIndexService {
  private readonly logger = new Logger(KnowledgeIndexService.name);
  private status: KnowledgeIndexStatus = { state: 'idle', indexedChunks: 0 };
  private rebuildPromise?: Promise<KnowledgeIndexStatus>;

  constructor(
    private readonly knowledgeRepo: MarkdownKnowledgeRepository,
    private readonly ragService: RagService,
  ) {}

  scheduleRebuild(): void {
    queueMicrotask(() => {
      void this.rebuild();
    });
  }

  rebuild(): Promise<KnowledgeIndexStatus> {
    this.rebuildPromise ??= this.buildIndex().finally(() => {
      this.rebuildPromise = undefined;
    });
    return this.rebuildPromise;
  }

  getStatus(): KnowledgeIndexStatus {
    return { ...this.status };
  }

  private async buildIndex(): Promise<KnowledgeIndexStatus> {
    this.logger.log('Building Knowledge Index from repository...');
    this.status = {
      state: 'building',
      indexedChunks: 0,
      startedAt: new Date().toISOString(),
    };

    try {
      const documents = await this.knowledgeRepo.getDocuments();
      await this.ragService.resetIndex();
      let totalChunks = 0;
      const failures: string[] = [];
      for (const doc of documents) {
        try {
          const chunks = await this.ragService.importDocument(doc.content, doc.id);
          totalChunks += chunks;
        } catch (error: unknown) {
          const message = `${doc.id}: ${(error as Error).message}`;
          failures.push(message);
          this.logger.error(`Failed to index document ${message}`);
        }
      }

      this.status = {
        state: failures.length === 0 ? 'ready' : 'degraded',
        indexedChunks: totalChunks,
        startedAt: this.status.startedAt,
        completedAt: new Date().toISOString(),
        ...(failures.length > 0 && { error: failures.join('; ').slice(0, 1000) }),
      };
      this.logger.log(
        `Knowledge Index rebuild finished. Total indexed chunks: ${String(totalChunks)}`,
      );
    } catch (error: unknown) {
      this.status = {
        state: 'degraded',
        indexedChunks: 0,
        startedAt: this.status.startedAt,
        completedAt: new Date().toISOString(),
        error: (error as Error).message.slice(0, 1000),
      };
      this.logger.error(`Knowledge Index rebuild failed: ${(error as Error).message}`);
    }
    return this.getStatus();
  }
}
