 
import { Controller, Get, Param, Query, UseGuards, NotFoundException } from '@nestjs/common';
import { MarkdownKnowledgeRepository } from './markdown-knowledge.repository';
import { RagService } from '../rag/rag.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { KnowledgeDocumentDTO, KnowledgeSearchResultDTO } from '@lg-agent/contracts';

@Controller('ai/knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(
    private readonly knowledgeRepo: MarkdownKnowledgeRepository,
    private readonly ragService: RagService,
  ) {}

  @Get()
  async listDocuments(): Promise<KnowledgeDocumentDTO[]> {
    return this.knowledgeRepo.getDocuments();
  }

  @Get('search')
  async search(@Query('q') query: string): Promise<KnowledgeSearchResultDTO[]> {
    if (!query) return [];
    
    const results = await this.ragService.search(query, 5);
    return results.map(r => {
      const source = (r.chunk.metadata?.['source']) ? r.chunk.metadata['source'] as string : 'unknown';
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
      throw new NotFoundException(`Knowledge document ${id} not found`);
    }
    return doc;
  }
}
