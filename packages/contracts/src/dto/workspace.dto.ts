export interface WorkspaceFileDTO {
  id?: string;
  path: string;
  content: string;
  language?: string;
  encoding?: string;
  readonly?: boolean;
  hidden?: boolean;
  locked?: boolean; // enterprise extension point
  visibility?: 'public' | 'private' | 'internal'; // enterprise extension point
}

export interface WorkspaceVersionDTO {
  id: string;
  workspaceId: string;
  version: number;
  trigger: string;
  snapshot: WorkspaceFileDTO[];
  createdAt: string;
}

export interface WorkspaceDTO {
  id?: string; // Database ID
  taskId: string;
  userId?: string;
  status?: string;
  workspace: {
    entry?: string;
    files: WorkspaceFileDTO[];
    metadata?: Record<string, unknown>;
  };
}

export enum ExecutionEventType {
  RUNNING = 'RUNNING',
  LOG = 'LOG',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  COMPLETE = 'COMPLETE',
}

export interface ExecutionEventDTO {
  type: ExecutionEventType;
  data?: unknown;
  message?: string;
  timestamp: string;
}
