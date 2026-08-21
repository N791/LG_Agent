import { ConversationType } from './conversation.dto';
import type {
  CitationDTO,
  ContextEnvelopeDTO,
  RetrievalTraceSummaryDTO,
  TokenBudgetAllocationDTO,
} from './retrieval.dto';

export class RefreshTokenRequestDTO {
  refresh_token!: string;
}
export class LoginRequestDTO {
  username!: string;
  password!: string;
}
export interface AuthTokenPairDTO {
  access_token: string;
  refresh_token: string;
}
export class InitWorkspaceRequestDTO {
  taskId!: string;
}
export class WorkspaceFileUpdateDTO {
  path!: string;
  content!: string;
}
export class UpdateWorkspaceFilesRequestDTO {
  files!: WorkspaceFileUpdateDTO[];
}
export class CreateWorkspaceVersionRequestDTO {
  trigger!: 'RUN' | 'SUBMIT' | 'MANUAL';
}

export class ChatRequestDTO {
  action!: ConversationType | string;
  taskId!: string;
  content!: string;
  stream?: boolean;
  conversationId?: string;
  activeFile?: string;
  activeFileContent?: string;
  repositorySnapshotId?: string;
  workspaceVersionId?: string;
  submissionLog?: string;
  taskState?: string;
  selection?: {
    content: string;
    startLine?: number;
    endLine?: number;
  };
}

export type EvidenceSupportDTO = 'SUPPORTED' | 'INFERENCE' | 'INSUFFICIENT';

export interface TutorResponseDTO {
  answer: string;
  citations: CitationDTO[];
  traceSummary: RetrievalTraceSummaryDTO;
  evidenceSupport: EvidenceSupportDTO;
  degraded: boolean;
  model?: string;
  provider?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface TutorStreamDoneDTO {
  citations: CitationDTO[];
  traceSummary: RetrievalTraceSummaryDTO;
  tokenBudget: TokenBudgetAllocationDTO;
  evidenceSupport: EvidenceSupportDTO;
  degraded: boolean;
}

export interface RetrievalPreviewRequestDTO extends ChatRequestDTO {
  disclosureLevel?: 'L0' | 'L1' | 'L2';
}

export interface RetrievalPreviewResponseDTO {
  context: ContextEnvelopeDTO;
  traceSummary: RetrievalTraceSummaryDTO;
}

export class GenerateTaskRequestDTO {
  document!: string;
}
export class UpdateProfileRequestDTO {
  nickname?: string;
  email?: string;
}
export class ChangePasswordRequestDTO {
  currentPassword!: string;
  newPassword!: string;
}
export class SetPreferenceRequestDTO {
  value!: string;
}
export class TogglePreferenceRequestDTO {
  enabled!: boolean;
}

export class UpdateAiConfigsRequestDTO {
  OPENAI_BASE_URL?: string;
  OPENAI_DEFAULT_MODEL?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_BASE_URL?: string;
  DEEPSEEK_DEFAULT_MODEL?: string;
  DEEPSEEK_API_KEY?: string;
  MOCK_LLM_ENABLED?: string;
  DEFAULT_AI_PROVIDER?: string;
  RAG_ENABLED?: string;
  RAG_TOP_K?: string;
  RAG_CHUNK_SIZE?: string;
}

export class CreateDiscussionRequestDTO {
  taskId!: string;
  workspaceId?: string;
  submissionId?: string;
  contextType!: string;
  title!: string;
  priority?: string;
  initialComment!: string;
  codeSnippet?: unknown;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  isInternal?: boolean;
  mentions?: string[];
}

export class AddDiscussionCommentRequestDTO {
  content!: string;
  codeSnippet?: unknown;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  isInternal?: boolean;
  mentions?: string[];
}

export class UpdateDiscussionStatusRequestDTO {
  status!: string;
}
export class AssignDiscussionRequestDTO {
  assignedToId!: string;
}

export interface ApiSuccessEnvelopeDTO<T> {
  code: number;
  message: string;
  data: T;
}

export interface ApiErrorEnvelopeDTO {
  code: number;
  message: string;
  details?: unknown;
  traceId?: string;
}

export const SSE_CONTRACT_VERSION = '1.0' as const;

export interface VersionedSseEventDTO<T = unknown> {
  version: typeof SSE_CONTRACT_VERSION;
  type: string;
  data?: T;
  message?: string;
  timestamp: string;
}
