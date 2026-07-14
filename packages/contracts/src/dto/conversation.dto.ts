export enum ConversationType {
  CHAT = 'chat',
  CODE_REVIEW = 'code-review',
  HINT = 'hint',
  EXPLAIN_ERROR = 'explain-error',
  REFACTOR = 'refactor',
}

export interface ConversationMessageDTO {
  id: string;
  role: 'system' | 'user' | 'assistant';
  content: string;
  model?: string;
  tokenUsage?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface ConversationDTO {
  id: string;
  organizationId: string;
  userId: string;
  taskId: string;
  status: string;
  messages: ConversationMessageDTO[];
  createdAt: Date;
  updatedAt: Date;
}
