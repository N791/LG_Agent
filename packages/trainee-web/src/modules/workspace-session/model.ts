import type {
  AiReviewDTO,
  ExecutionMetricsDTO,
  SandboxAction,
  WorkspaceFileDTO,
  WorkspaceVersionDTO,
} from '@lg-agent/contracts';

export type WorkspaceFiles = Record<string, string>;
export type WorkspaceSessionPhase = 'IDLE' | 'LOADING' | 'READY' | 'CONFLICT' | 'ERROR';
export type ConflictResolution = 'REMOTE' | 'LOCAL' | 'MERGED';

export interface WorkspaceOfflineSnapshot {
  schemaVersion: 2;
  taskId: string;
  baselineFiles: WorkspaceFiles;
  draftFiles: WorkspaceFiles;
  dirtyFiles: string[];
  activeFile: string | null;
  openFiles: string[];
  updatedAt: string;
}

export interface WorkspaceConflict {
  files: string[];
  remoteFiles: WorkspaceFiles;
  localFiles: WorkspaceFiles;
}

export interface WorkspaceExecutionState {
  mode: 'LIVE' | 'HISTORY';
  submissionId?: string | null;
  status: 'IDLE' | 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ERROR' | 'STOPPED';
  logs: string;
  metrics: ExecutionMetricsDTO | null;
  report: { exitCode?: number | null; message?: string } | null;
  score: number | null;
  error: string | null;
  aiReview?: AiReviewDTO | null;
}

export interface WorkspaceSessionState {
  phase: WorkspaceSessionPhase;
  taskId: string | null;
  workspaceId: string | null;
  remoteBaseline: WorkspaceFiles;
  fileMetadata: Record<string, WorkspaceFileDTO>;
  draft: WorkspaceFiles;
  dirtyFiles: string[];
  offlineSnapshot: WorkspaceOfflineSnapshot | null;
  versions: WorkspaceVersionDTO[];
  execution: WorkspaceExecutionState;
  conflict: WorkspaceConflict | null;
  activeFile: string | null;
  openFiles: string[];
  recentFiles: string[];
  error: string | null;
  isSaving: boolean;
}

export interface WorkspaceExecutionEvent {
  type?: string;
  message?: string;
  data?: {
    text?: string;
    score?: number;
    report?: { exitCode?: number | null; message?: string };
    exitCode?: number;
  };
}

export interface WorkspaceSessionCommands {
  load(taskId: string): Promise<WorkspaceSessionState>;
  resolveConflict(
    resolution: ConflictResolution,
    perFile?: Record<string, { resolution: ConflictResolution; content?: string }>,
  ): Promise<void>;
  edit(path: string, content: string): Promise<void>;
  open(path: string): void;
  close(path: string): void;
  setActiveFile(path: string | null): void;
  reorderOpenFiles(fromIndex: number, toIndex: number): void;
  save(): Promise<void>;
  createFile(path: string, content?: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  renameFile(path: string, nextPath: string): Promise<void>;
  refreshVersions(): Promise<void>;
  createSnapshot(trigger: 'RUN' | 'SUBMIT' | 'MANUAL'): Promise<void>;
  restoreVersion(
    versionId: string,
    dirtyPolicy?: 'REJECT' | 'DISCARD' | 'KEEP_LOCAL',
  ): Promise<void>;
  run(action: SandboxAction): Promise<void>;
  submit(): Promise<void>;
  clear(): void;
}

export const EMPTY_EXECUTION: WorkspaceExecutionState = {
  mode: 'LIVE',
  status: 'IDLE',
  logs: '',
  metrics: null,
  report: null,
  score: null,
  error: null,
};

export const EMPTY_WORKSPACE_SESSION: WorkspaceSessionState = {
  phase: 'IDLE',
  taskId: null,
  workspaceId: null,
  remoteBaseline: {},
  fileMetadata: {},
  draft: {},
  dirtyFiles: [],
  offlineSnapshot: null,
  versions: [],
  execution: EMPTY_EXECUTION,
  conflict: null,
  activeFile: null,
  openFiles: [],
  recentFiles: [],
  error: null,
  isSaving: false,
};
