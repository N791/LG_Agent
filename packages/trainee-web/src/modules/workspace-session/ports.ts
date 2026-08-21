import type {
  SandboxAction,
  WorkspaceDTO,
  WorkspaceFileDTO,
  WorkspaceVersionDTO,
} from '@lg-agent/contracts';
import type { WorkspaceExecutionEvent, WorkspaceOfflineSnapshot } from './model';

export interface AuthoringWorkspacePort {
  load(taskId: string): Promise<WorkspaceDTO>;
  saveFiles(
    taskId: string,
    files: Pick<WorkspaceFileDTO, 'path' | 'content'>[],
  ): Promise<WorkspaceDTO>;
  deleteFile(taskId: string, path: string): Promise<WorkspaceDTO>;
  createVersion(taskId: string, trigger: 'RUN' | 'SUBMIT' | 'MANUAL'): Promise<void>;
  listVersions(taskId: string): Promise<WorkspaceVersionDTO[]>;
  restoreVersion(taskId: string, versionId: string): Promise<WorkspaceDTO>;
}

export interface OfflineSnapshotPort {
  load(taskId: string): Promise<WorkspaceOfflineSnapshot | null>;
  save(snapshot: WorkspaceOfflineSnapshot): Promise<void>;
  clear(taskId: string): Promise<void>;
}

export interface WorkspaceExecutionPort {
  run(
    taskId: string,
    action: SandboxAction,
    onEvent: (event: WorkspaceExecutionEvent) => void,
  ): Promise<string>;
  submit(taskId: string, onEvent: (event: WorkspaceExecutionEvent) => void): Promise<string>;
}

export interface WorkspaceSessionPorts {
  workspace: AuthoringWorkspacePort;
  offline: OfflineSnapshotPort;
  execution: WorkspaceExecutionPort;
  now?: () => number;
}
