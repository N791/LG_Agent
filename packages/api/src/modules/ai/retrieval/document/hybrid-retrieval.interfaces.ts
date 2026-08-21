import type { RetrievalScopeDTO } from '@lg-agent/contracts';
import type { DocumentLocator } from './document-structure.types';

export type RetrievalChannel = 'keyword' | 'vector';

export interface DocumentSearchFilter {
  knowledgeSourceIds?: string[];
  documentVersionIds?: string[];
  metadataFilters?: Record<string, string | number | boolean>;
}

export interface DocumentSearchRequest extends RetrievalScopeDTO, DocumentSearchFilter {
  query: string;
  limit: number;
}

export interface DocumentCandidate {
  chunkId: string;
  nodeId: string;
  parentId?: string;
  documentId: string;
  documentVersionId: string;
  version: string;
  organizationId: string;
  sourceTitle: string;
  sourceUri: string;
  content: string;
  sectionPath: string[];
  locator: DocumentLocator;
  rawScore: number;
  rawRank: number;
  channel: RetrievalChannel;
  hitReason: string;
}

export interface FusedDocumentCandidate extends Omit<DocumentCandidate, 'channel'> {
  fusedScore: number;
  fusedRank: number;
  channels: Partial<
    Record<RetrievalChannel, { rawRank: number; rawScore: number; hitReason: string }>
  >;
  rerankScore?: number;
}

export interface ExpansionRequest extends RetrievalScopeDTO {
  chunkId: string;
  documentVersionId: string;
  tokenBudget: number;
}

export interface IDocumentSearchChannel {
  search(request: DocumentSearchRequest): Promise<DocumentCandidate[]>;
}

export interface IDocumentExpansionStore {
  expand(request: ExpansionRequest): Promise<DocumentCandidate[]>;
}

export interface IDocumentReranker {
  rerank(query: string, candidates: FusedDocumentCandidate[]): Promise<FusedDocumentCandidate[]>;
}

export interface RetrievalStageObservation {
  stage: 'keyword' | 'vector' | 'fusion' | 'rerank' | 'expansion';
  status: 'ok' | 'degraded' | 'failed';
  durationMs: number;
  candidateCount: number;
  reason?: string;
}

export interface IRetrievalObserver {
  observe(observation: RetrievalStageObservation): void;
}

export const DOCUMENT_KEYWORD_SEARCH = Symbol('IDocumentKeywordSearch');
export const DOCUMENT_VECTOR_SEARCH = Symbol('IDocumentVectorSearch');
export const DOCUMENT_EXPANSION_STORE = Symbol('IDocumentExpansionStore');
export const DOCUMENT_RERANKER = Symbol('IDocumentReranker');
export const RETRIEVAL_OBSERVER = Symbol('IRetrievalObserver');
