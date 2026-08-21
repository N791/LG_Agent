import { Injectable, Logger } from '@nestjs/common';
import type {
  EvidenceDTO,
  RetrievalTraceEvidenceDTO,
  RetrievalTraceStageDTO,
  RetrievalTraceToolCallDTO,
} from '@lg-agent/contracts';

export interface RetrievalTraceRecord {
  traceId: string;
  organizationId: string;
  route: string;
  policyVersion: string;
  cacheHit: boolean;
  tokenUsed: number;
  durationMs: number;
  evidence: RetrievalTraceEvidenceDTO[];
  stages: RetrievalTraceStageDTO[];
  toolCalls: RetrievalTraceToolCallDTO[];
}

@Injectable()
export class RetrievalTraceService {
  private readonly logger = new Logger(RetrievalTraceService.name);
  private readonly recent = new Map<string, RetrievalTraceRecord>();

  record(input: Omit<RetrievalTraceRecord, 'evidence'> & { evidence: EvidenceDTO[] }): void {
    const record: RetrievalTraceRecord = {
      ...input,
      evidence: input.evidence.map((item) => ({
        evidenceId: item.id,
        route: item.route,
        revision: item.citation.revision,
        score: item.score,
        citationId: item.citation.id,
        disclosureLevel: item.disclosureLevel,
      })),
    };
    this.recent.set(record.traceId, record);
    if (this.recent.size > 250) {
      const oldest = this.recent.keys().next().value;
      if (oldest) this.recent.delete(oldest);
    }
    // This serialized record cannot contain raw evidence content by construction.
    this.logger.debug(JSON.stringify({ event: 'retrieval_trace', ...record }));
  }

  get(traceId: string, organizationId: string): RetrievalTraceRecord | undefined {
    const record = this.recent.get(traceId);
    return record?.organizationId === organizationId ? structuredClone(record) : undefined;
  }
}
