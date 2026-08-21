import { createHash } from 'node:crypto';
import { Injectable, Optional } from '@nestjs/common';
import type {
  EvidenceDTO,
  ExpandDocumentInputDTO,
  SearchDocumentsInputDTO,
} from '@lg-agent/contracts';
import type { IDocumentRetriever } from '../interfaces';
import { LegacyDocumentRetrieverAdapter } from '../legacy-document-retriever.adapter';
import { RetrievalFeatureFlags } from '../retrieval-feature-flags.service';
import { RetrievalShadowService } from '../evaluation/retrieval-shadow.service';
import { HybridDocumentRetrieverAdapter } from './hybrid-document-retriever.adapter';

@Injectable()
export class RolloutDocumentRetrieverAdapter implements IDocumentRetriever {
  constructor(
    private readonly flags: RetrievalFeatureFlags,
    private readonly legacy: LegacyDocumentRetrieverAdapter,
    private readonly hybrid: HybridDocumentRetrieverAdapter,
    @Optional() private readonly shadow?: RetrievalShadowService,
  ) {}

  async searchDocuments(input: SearchDocumentsInputDTO): Promise<EvidenceDTO[]> {
    const rollout = this.flags.forOrganization(input.organizationId, input.userId, input.courseId);
    if (rollout.mode === 'ACTIVE') return this.hybrid.searchDocuments(input);
    if (rollout.shadowRead) {
      const startedAt = Date.now();
      const candidate = this.hybrid.searchDocuments(input);
      const served = await this.legacy.searchDocuments(input);
      const queryHash = createHash('sha256').update(input.query).digest('hex').slice(0, 16);
      void candidate
        .then((result) =>
          this.shadow?.compare(
            input.organizationId,
            queryHash,
            served,
            result,
            Date.now() - startedAt,
          ),
        )
        .catch(() => {
          // Shadow failures never affect the learner-visible legacy response.
          this.shadow?.failed(input.organizationId, queryHash, Date.now() - startedAt);
        });
      return served;
    }
    return this.legacy.searchDocuments(input);
  }

  expandDocument(input: ExpandDocumentInputDTO): Promise<EvidenceDTO[]> {
    return this.flags.forOrganization(input.organizationId, input.userId, input.courseId).mode ===
      'ACTIVE'
      ? this.hybrid.expandDocument(input)
      : this.legacy.expandDocument(input);
  }
}
