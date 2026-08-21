import type {
  EvidenceDTO,
  ExpandDocumentInputDTO,
  ExpandSymbolInputDTO,
  OrchestrateContextInputDTO,
  ReadSymbolInputDTO,
  RetrievalToolResultDTO,
  RouteQueryInputDTO,
  RouteQueryResultDTO,
  SearchDocumentsInputDTO,
  SearchSymbolsInputDTO,
} from '@lg-agent/contracts';

export const DOCUMENT_RETRIEVER = Symbol('IDocumentRetriever');
export const CODE_RETRIEVER = Symbol('ICodeRetriever');
export const QUERY_ROUTER = Symbol('IQueryRouter');
export const CONTEXT_ORCHESTRATOR = Symbol('IContextOrchestrator');

export interface IDocumentRetriever {
  searchDocuments(input: SearchDocumentsInputDTO): Promise<EvidenceDTO[]>;
  expandDocument(input: ExpandDocumentInputDTO): Promise<EvidenceDTO[]>;
}

export interface ICodeRetriever {
  searchSymbols(input: SearchSymbolsInputDTO): Promise<EvidenceDTO[]>;
  readSymbol(input: ReadSymbolInputDTO): Promise<EvidenceDTO[]>;
  expandSymbol(input: ExpandSymbolInputDTO): Promise<EvidenceDTO[]>;
}

export interface IQueryRouter {
  route(input: RouteQueryInputDTO): Promise<RouteQueryResultDTO>;
}

export interface IContextOrchestrator {
  retrieve(input: OrchestrateContextInputDTO): Promise<RetrievalToolResultDTO>;
}
