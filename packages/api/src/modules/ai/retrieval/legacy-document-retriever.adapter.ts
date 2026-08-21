import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DisclosureLevelDTO,
  RetrievalErrorCodeDTO,
  RetrievalRouteDTO,
  type EvidenceDTO,
  type ExpandDocumentInputDTO,
  type SearchDocumentsInputDTO,
} from '@lg-agent/contracts';
import { RagService } from '../rag/rag.service';
import type { IDocumentRetriever } from './interfaces';
import { RetrievalPortError } from './retrieval.error';

/**
 * Compatibility adapter for the pre-Sprint-17 vector index.
 * It is the only retrieval component allowed to understand the legacy RAG shape.
 */
@Injectable()
export class LegacyDocumentRetrieverAdapter implements IDocumentRetriever {
  constructor(private readonly ragService: RagService) {}

  async searchDocuments(input: SearchDocumentsInputDTO): Promise<EvidenceDTO[]> {
    if (!input.query.trim()) {
      throw new RetrievalPortError(
        RetrievalErrorCodeDTO.INVALID_QUERY,
        'Document search query must not be empty.',
      );
    }
    const results = await this.ragService.search(input.query, input.topK);
    return results.map(({ chunk, score }) => {
      const rawSource = chunk.metadata?.['source'];
      const source =
        typeof rawSource === 'string' && rawSource.length > 0 ? rawSource : 'legacy-knowledge';
      // Content-address the compatibility revision so a changed source cannot reuse an old citation.
      const revision = createHash('sha256').update(`${source}\0${chunk.content}`).digest('hex');
      const evidenceId = `document:${revision}:${chunk.id}`;
      return {
        id: evidenceId,
        organizationId: input.organizationId,
        route: RetrievalRouteDTO.DOCUMENT,
        disclosureLevel: input.disclosureLevel ?? DisclosureLevelDTO.L1,
        content: chunk.content,
        score,
        citation: {
          id: `citation:${evidenceId}`,
          organizationId: input.organizationId,
          title: source,
          uri: `knowledge://${encodeURIComponent(source)}?revision=${revision}`,
          documentVersionId: `legacy:${revision}`,
          revision,
          locator: { path: source },
        },
        metadata: { compatibilityAdapter: true },
      };
    });
  }

  expandDocument(_input: ExpandDocumentInputDTO): Promise<EvidenceDTO[]> {
    throw new RetrievalPortError(
      RetrievalErrorCodeDTO.INDEX_NOT_READY,
      'Parent document expansion requires the versioned document index.',
    );
  }
}
