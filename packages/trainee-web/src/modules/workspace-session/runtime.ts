import { useSyncExternalStore } from 'react';
import {
  HttpAuthoringWorkspaceAdapter,
  HttpWorkspaceExecutionAdapter,
} from './internal/http-adapters';
import { IndexedDbWorkspaceSnapshotAdapter } from './internal/indexed-db-adapter';
import { WorkspaceSession } from './workspace-session';
import type { WorkspaceSessionState } from './model';

export const workspaceSession = new WorkspaceSession({
  workspace: new HttpAuthoringWorkspaceAdapter(),
  offline: new IndexedDbWorkspaceSnapshotAdapter(),
  execution: new HttpWorkspaceExecutionAdapter(),
});

export const workspaceSessionCommands = workspaceSession;

export function useWorkspaceSession<T>(selector: (state: WorkspaceSessionState) => T): T {
  return useSyncExternalStore(
    workspaceSession.subscribe,
    () => selector(workspaceSession.getState()),
    () => selector(workspaceSession.getState()),
  );
}

export const workspaceSessionSelectors = {
  activeFile: (state: WorkspaceSessionState) => state.activeFile,
  activeFileContent: (state: WorkspaceSessionState) =>
    state.activeFile ? state.draft[state.activeFile] : undefined,
  activeFileContext: (state: WorkspaceSessionState) =>
    state.activeFile
      ? { path: state.activeFile, content: state.draft[state.activeFile] ?? '' }
      : null,
  hasDirtyFiles: (state: WorkspaceSessionState) => state.dirtyFiles.length > 0,
  isBusy: (state: WorkspaceSessionState) =>
    state.execution.status === 'PENDING' || state.execution.status === 'RUNNING',
};
