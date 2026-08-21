export enum RetrievalRouteDTO {
  DOCUMENT = 'DOCUMENT',
  CODE = 'CODE',
  MIXED = 'MIXED',
  TASK_STATE = 'TASK_STATE',
  CONVERSATION = 'CONVERSATION',
}

export enum DisclosureLevelDTO {
  L0 = 'L0',
  L1 = 'L1',
  L2 = 'L2',
}

export enum RetrievalErrorCodeDTO {
  INVALID_QUERY = 'RETRIEVAL_INVALID_QUERY',
  SOURCE_NOT_FOUND = 'RETRIEVAL_SOURCE_NOT_FOUND',
  VERSION_NOT_FOUND = 'RETRIEVAL_VERSION_NOT_FOUND',
  SNAPSHOT_NOT_FOUND = 'RETRIEVAL_SNAPSHOT_NOT_FOUND',
  EVIDENCE_NOT_FOUND = 'RETRIEVAL_EVIDENCE_NOT_FOUND',
  INDEX_NOT_READY = 'RETRIEVAL_INDEX_NOT_READY',
  INDEX_CONFLICT = 'RETRIEVAL_INDEX_CONFLICT',
  ACCESS_DENIED = 'RETRIEVAL_ACCESS_DENIED',
  BUDGET_EXCEEDED = 'RETRIEVAL_BUDGET_EXCEEDED',
  TIMEOUT = 'RETRIEVAL_TIMEOUT',
  POLICY_VIOLATION = 'RETRIEVAL_POLICY_VIOLATION',
  ADAPTER_UNAVAILABLE = 'RETRIEVAL_ADAPTER_UNAVAILABLE',
  INTERNAL = 'RETRIEVAL_INTERNAL',
}

export enum IndexJobStatusDTO {
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  READY = 'READY',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export interface CitationDTO {
  id: string;
  organizationId: string;
  title: string;
  uri: string;
  /** Immutable document-version id. Present only for document evidence. */
  documentVersionId?: string;
  /** Stable source and leaf identifiers used by document preview deep links. */
  documentId?: string;
  chunkId?: string;
  /** Immutable repository snapshot id. Present only for code evidence. */
  repositorySnapshotId?: string;
  /** Repository identity and symbol pin used by code evidence. */
  repositoryId?: string;
  symbolId?: string;
  /** Human-readable immutable version/commit label. */
  revision: string;
  locator: {
    path?: string;
    heading?: string;
    page?: number;
    anchor?: string;
    symbol?: string;
    startLine?: number;
    endLine?: number;
  };
}

export interface EvidenceDTO {
  id: string;
  organizationId: string;
  route: RetrievalRouteDTO;
  disclosureLevel: DisclosureLevelDTO;
  content: string;
  score: number;
  citation: CitationDTO;
  metadata?: Record<string, unknown>;
}

export interface RetrievalTraceSummaryDTO {
  traceId: string;
  organizationId: string;
  route: RetrievalRouteDTO;
  disclosureLevel: DisclosureLevelDTO;
  evidenceCount: number;
  totalCandidates: number;
  durationMs: number;
  cacheHit: boolean;
  shadowRead: boolean;
  createdAt: string;
  policyVersion?: string;
  routeReasons?: string[];
  tokenBudget?: TokenBudgetAllocationDTO;
  disclosureUpgrades?: DisclosureUpgradeDTO[];
  /** Metadata-only stage records. Raw evidence content is intentionally excluded. */
  stages?: RetrievalTraceStageDTO[];
  evidence?: RetrievalTraceEvidenceDTO[];
  toolCalls?: RetrievalTraceToolCallDTO[];
  degraded?: boolean;
  degradationReasons?: string[];
}

export type RetrievalAclStageDTO = 'RECALL' | 'POST_RERANK' | 'EXPANSION' | 'CITATION_OPEN';

export interface RetrievalTraceStageDTO {
  name: string;
  durationMs: number;
  candidateCount: number;
  status: 'OK' | 'DEGRADED' | 'FAILED';
  aclStage?: RetrievalAclStageDTO;
  reasonCode?: string;
}

export interface RetrievalTraceEvidenceDTO {
  evidenceId: string;
  route: RetrievalRouteDTO;
  revision: string;
  score: number;
  citationId: string;
  disclosureLevel: DisclosureLevelDTO;
}

export interface RetrievalTraceToolCallDTO {
  name: 'search_documents' | 'expand_document' | 'search_symbols' | 'read_symbol' | 'expand_symbol';
  durationMs: number;
  resultCount: number;
  status: 'OK' | 'TIMEOUT' | 'DENIED' | 'FAILED';
}

export interface KnowledgeIndexJobDTO {
  id: string;
  organizationId: string;
  knowledgeSourceId: string;
  documentVersionId: string;
  status: IndexJobStatusDTO;
  errorCode?: RetrievalErrorCodeDTO;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress?: number;
  failureCategory?: string;
  retryCount?: number;
  contentHash?: string;
  indexVersion?: string;
  buildDurationMs?: number;
}

export interface RepositoryIndexJobDTO {
  id: string;
  organizationId: string;
  repositoryId: string;
  repositorySnapshotId: string;
  commitSha: string;
  status: IndexJobStatusDTO;
  errorCode?: RetrievalErrorCodeDTO;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  progress?: number;
  failureCategory?: string;
  retryCount?: number;
  contentHash?: string;
  indexVersion?: string;
  buildDurationMs?: number;
}

export interface RetrievalScopeDTO {
  organizationId: string;
  userId: string;
  courseId?: string;
  taskId?: string;
  conversationId?: string;
}

export interface SearchDocumentsInputDTO extends RetrievalScopeDTO {
  query: string;
  topK?: number;
  disclosureLevel?: DisclosureLevelDTO;
  knowledgeSourceIds?: string[];
  documentVersionIds?: string[];
  metadataFilters?: Record<string, string | number | boolean>;
}

export interface ExpandDocumentInputDTO extends RetrievalScopeDTO {
  evidenceId: string;
  disclosureLevel: DisclosureLevelDTO;
}

export interface SearchSymbolsInputDTO extends RetrievalScopeDTO {
  query: string;
  repositorySnapshotId?: string;
  topK?: number;
  disclosureLevel?: DisclosureLevelDTO;
}

export interface ReadSymbolInputDTO extends RetrievalScopeDTO {
  repositorySnapshotId: string;
  symbolId: string;
  disclosureLevel?: DisclosureLevelDTO;
}

export interface ExpandSymbolInputDTO extends ReadSymbolInputDTO {
  relationTypes?: (
    | 'DEFINES'
    | 'CALLS'
    | 'CALLED_BY'
    | 'IMPORTS'
    | 'REFERENCES'
    | 'IMPLEMENTS'
    | 'EXTENDS'
    | 'TESTED_BY'
  )[];
  depth?: number;
  limit?: number;
}

export interface RetrievalToolResultDTO {
  evidence: EvidenceDTO[];
  trace: RetrievalTraceSummaryDTO;
  context?: ContextEnvelopeDTO;
}

export interface RetrievalToolContractDTO<TName extends string, TInput> {
  name: TName;
  description: string;
  input: TInput;
}

export type SearchDocumentsToolDTO = RetrievalToolContractDTO<
  'search_documents',
  SearchDocumentsInputDTO
>;
export type ExpandDocumentToolDTO = RetrievalToolContractDTO<
  'expand_document',
  ExpandDocumentInputDTO
>;
export type SearchSymbolsToolDTO = RetrievalToolContractDTO<
  'search_symbols',
  SearchSymbolsInputDTO
>;
export type ReadSymbolToolDTO = RetrievalToolContractDTO<'read_symbol', ReadSymbolInputDTO>;
export type ExpandSymbolToolDTO = RetrievalToolContractDTO<'expand_symbol', ExpandSymbolInputDTO>;

export interface RouteQueryInputDTO extends RetrievalScopeDTO {
  query: string;
  preferredRoute?: RetrievalRouteDTO;
  tutorAction?: 'chat' | 'code-review' | 'hint' | 'explain-error' | 'refactor' | 'follow-up';
  activeFile?: {
    path: string;
    repositorySnapshotId?: string;
    language?: string;
  };
  selection?: {
    content: string;
    startLine?: number;
    endLine?: number;
  };
  errorLog?: string;
  taskStage?: string;
  taskState?: string;
  recentConversation?: string;
  filters?: RetrievalFilterDTO;
  aclFingerprint?: string;
  sourceVersions?: string[];
}

export interface RouteQueryResultDTO {
  route: RetrievalRouteDTO;
  confidence: number;
  reasons: string[];
  policyVersion: string;
  plan: RetrievalPlanDTO;
}

export interface OrchestrateContextInputDTO extends RouteQueryInputDTO {
  disclosureLevel?: DisclosureLevelDTO;
  maxEvidence?: number;
  totalTokenBudget?: number;
  safetyPolicyVersion?: string;
}

export interface RetrievalFilterDTO {
  knowledgeSourceIds?: string[];
  documentVersionIds?: string[];
  repositorySnapshotId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface RetrievalPlanDTO {
  primaryRoute: RetrievalRouteDTO;
  routes: RetrievalRouteDTO[];
  rewrittenQuery: string;
  filters: RetrievalFilterDTO;
  candidateLimit: number;
  targetDisclosureLevel: DisclosureLevelDTO;
  suggestedEvidenceTokens: number;
  lowConfidenceFallback: boolean;
}

export interface TokenBudgetAllocationDTO {
  total: number;
  systemPolicy: number;
  taskState: number;
  recentConversation: number;
  documents: number;
  code: number;
  toolResults: number;
  modelOutput: number;
  usedEvidence: number;
  truncated: boolean;
}

export interface DisclosureUpgradeDTO {
  evidenceId: string;
  from: DisclosureLevelDTO;
  to: DisclosureLevelDTO;
  reason: string;
  tokensConsumed: number;
  addedEvidenceIds: string[];
}

export interface ContextEnvelopeDTO {
  organizationId: string;
  route: RetrievalRouteDTO;
  policyVersion: string;
  evidence: EvidenceDTO[];
  citations: CitationDTO[];
  budget: TokenBudgetAllocationDTO;
  disclosureUpgrades: DisclosureUpgradeDTO[];
  cacheKey?: string;
}

export interface CitationOpenResponseDTO {
  available: boolean;
  citation: CitationDTO;
  content?: string;
  errorCode?: RetrievalErrorCodeDTO;
  recovery?: string;
}

export interface RetrievalIndexItemDTO {
  id: string;
  kind: 'DOCUMENT' | 'CODE';
  sourceId: string;
  sourceName: string;
  revision: string;
  status: IndexJobStatusDTO;
  active: boolean;
  failureReason?: string;
  createdAt: string;
  readyAt?: string;
  progress?: number;
  retryCount?: number;
  contentHash?: string;
  indexVersion?: string;
  buildDurationMs?: number;
}

export interface ConversationCompactionInputDTO extends RetrievalScopeDTO {
  messages: {
    id: string;
    role: 'system' | 'user' | 'assistant';
    content: string;
    evidenceIds?: string[];
  }[];
  keepRecentTurns?: number;
  previousSummary?: ConversationSummaryDTO;
  conflictingEvidenceIds?: string[];
}

export interface ConversationSummaryDTO {
  version: number;
  fromMessageId: string;
  throughMessageId: string;
  goals: string[];
  confirmedFacts: string[];
  decisions: string[];
  unresolvedQuestions: string[];
  evidenceIds: string[];
  retainedMessages: ConversationCompactionInputDTO['messages'];
  content: string;
}

export interface RetrievalToolDefinitionDTO {
  name: 'search_documents' | 'expand_document' | 'search_symbols' | 'read_symbol' | 'expand_symbol';
  description: string;
  inputSchema: {
    type: 'object';
    required: readonly string[];
    properties: Readonly<Record<string, { type: string; description?: string }>>;
  };
}

const scopeProperties = {
  organizationId: { type: 'string', description: 'Authenticated tenant id.' },
  userId: { type: 'string', description: 'Authenticated actor id.' },
} as const;

export const RETRIEVAL_TOOL_CONTRACTS: readonly RetrievalToolDefinitionDTO[] = [
  {
    name: 'search_documents',
    description: 'Search immutable document versions and return cited evidence.',
    inputSchema: {
      type: 'object',
      required: ['organizationId', 'userId', 'query'],
      properties: { ...scopeProperties, query: { type: 'string' }, topK: { type: 'number' } },
    },
  },
  {
    name: 'expand_document',
    description: 'Expand document evidence within its pinned document version.',
    inputSchema: {
      type: 'object',
      required: ['organizationId', 'userId', 'evidenceId', 'disclosureLevel'],
      properties: {
        ...scopeProperties,
        evidenceId: { type: 'string' },
        disclosureLevel: { type: 'string' },
      },
    },
  },
  {
    name: 'search_symbols',
    description: 'Search symbols within an immutable repository snapshot.',
    inputSchema: {
      type: 'object',
      required: ['organizationId', 'userId', 'query'],
      properties: { ...scopeProperties, query: { type: 'string' }, topK: { type: 'number' } },
    },
  },
  {
    name: 'read_symbol',
    description: 'Read one symbol pinned to a repository snapshot.',
    inputSchema: {
      type: 'object',
      required: ['organizationId', 'userId', 'repositorySnapshotId', 'symbolId'],
      properties: {
        ...scopeProperties,
        repositorySnapshotId: { type: 'string' },
        symbolId: { type: 'string' },
      },
    },
  },
  {
    name: 'expand_symbol',
    description: 'Expand symbol relations without leaving its repository snapshot.',
    inputSchema: {
      type: 'object',
      required: ['organizationId', 'userId', 'repositorySnapshotId', 'symbolId'],
      properties: {
        ...scopeProperties,
        repositorySnapshotId: { type: 'string' },
        symbolId: { type: 'string' },
        depth: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  },
] as const;
