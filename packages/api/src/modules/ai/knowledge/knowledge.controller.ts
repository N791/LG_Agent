import { Controller, Get, Param, Query, UseGuards, NotFoundException, Post } from '@nestjs/common';
import { MarkdownKnowledgeRepository } from './markdown-knowledge.repository';
import { RagService } from '../rag/rag.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { KnowledgeDocumentDTO, KnowledgeSearchResultDTO, PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../../authorization';
import { KnowledgeIndexService } from './knowledge-index.service';
import type { KnowledgeIndexStatus } from './knowledge-index.service';

@Controller('ai/knowledge')
@UseGuards(JwtAuthGuard)
@RequirePermission(PERMISSIONS.KNOWLEDGE_READ)
export class KnowledgeController {
  constructor(
    private readonly knowledgeRepo: MarkdownKnowledgeRepository,
    private readonly ragService: RagService,
    private readonly knowledgeIndex: KnowledgeIndexService,
  ) {}

  @Get('index/status')
  getIndexStatus(): KnowledgeIndexStatus {
    return this.knowledgeIndex.getStatus();
  }

  @Post('index/rebuild')
  @RequirePermission(PERMISSIONS.KNOWLEDGE_MANAGE)
  rebuildIndex(): Promise<KnowledgeIndexStatus> {
    return this.knowledgeIndex.rebuild();
  }

  @Get()
  async listDocuments(): Promise<KnowledgeDocumentDTO[]> {
    return this.knowledgeRepo.getDocuments();
  }

  @Get('search')
  async search(@Query('q') query: string): Promise<KnowledgeSearchResultDTO[]> {
    if (!query) return [];

    const results = await this.ragService.search(query, 5);
    return results.map((r) => {
      const source = r.chunk.metadata?.['source']
        ? (r.chunk.metadata['source'] as string)
        : 'unknown';
      return {
        chunkContent: r.chunk.content,
        source,
        score: r.score,
      };
    });
  }

  @Get(':id')
  async getDocument(@Param('id') id: string): Promise<KnowledgeDocumentDTO> {
    const doc = await this.knowledgeRepo.getDocument(id);
    if (!doc) {
      throw new NotFoundException({ message: 'errors.ai.knowledgeNotFound', args: { id } });
    }
    return doc;
  }
}
