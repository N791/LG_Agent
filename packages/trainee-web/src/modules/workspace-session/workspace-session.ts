import type { SandboxAction, WorkspaceDTO, WorkspaceFileDTO } from '@lg-agent/contracts';
import {
  EMPTY_EXECUTION,
  EMPTY_WORKSPACE_SESSION,
  type ConflictResolution,
  type WorkspaceExecutionEvent,
  type WorkspaceFiles,
  type WorkspaceOfflineSnapshot,
  type WorkspaceSessionCommands,
  type WorkspaceSessionState,
} from './model';
import type { WorkspaceSessionPorts } from './ports';

export class WorkspaceSessionError extends Error {}
export class WorkspaceConflictError extends WorkspaceSessionError {}
export class UnsavedWorkspaceChangesError extends WorkspaceSessionError {}

function workspaceFiles(workspace: WorkspaceDTO): WorkspaceFiles {
  return Object.fromEntries(workspace.workspace.files.map((file) => [file.path, file.content]));
}

function workspaceMetadata(workspace: WorkspaceDTO): Record<string, WorkspaceFileDTO> {
  return Object.fromEntries(workspace.workspace.files.map((file) => [file.path, { ...file }]));
}

function changedFiles(baseline: WorkspaceFiles, draft: WorkspaceFiles): string[] {
  return [...new Set([...Object.keys(baseline), ...Object.keys(draft)])]
    .filter((path) => baseline[path] !== draft[path])
    .sort();
}

function withoutFile(files: WorkspaceFiles, path: string): WorkspaceFiles {
  return Object.fromEntries(Object.entries(files).filter(([key]) => key !== path));
}

function mergeDraft(
  remote: WorkspaceFiles,
  local: WorkspaceFiles,
  dirtyFiles: string[],
): WorkspaceFiles {
  let result = { ...remote };
  for (const path of dirtyFiles) {
    if (path in local) result[path] = local[path] ?? '';
    else result = withoutFile(result, path);
  }
  return result;
}

export class WorkspaceSession implements WorkspaceSessionCommands {
  private state: WorkspaceSessionState = EMPTY_WORKSPACE_SESSION;
  private readonly listeners = new Set<() => void>();
  private savePromise: Promise<void> | null = null;

  private readonly ports: WorkspaceSessionPorts;

  constructor(ports: WorkspaceSessionPorts) {
    this.ports = ports;
  }

  getState = (): WorkspaceSessionState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private transition(patch: Partial<WorkspaceSessionState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((listener) => {
      listener();
    });
  }

  private requireTask(): string {
    if (!this.state.taskId) throw new WorkspaceSessionError('Workspace session is not loaded');
    return this.state.taskId;
  }

  private snapshot(): WorkspaceOfflineSnapshot {
    return {
      schemaVersion: 2,
      taskId: this.requireTask(),
      baselineFiles: { ...this.state.remoteBaseline },
      draftFiles: { ...this.state.draft },
      dirtyFiles: [...this.state.dirtyFiles],
      activeFile: this.state.activeFile,
      openFiles: [...this.state.openFiles],
      updatedAt: new Date(this.ports.now?.() ?? Date.now()).toISOString(),
    };
  }

  private async persistDraft(): Promise<void> {
    if (this.state.dirtyFiles.length === 0) {
      await this.ports.offline.clear(this.requireTask());
      this.transition({ offlineSnapshot: null });
      return;
    }
    const snapshot = this.snapshot();
    this.transition({ offlineSnapshot: snapshot });
    await this.ports.offline.save(snapshot);
  }

  async load(taskId: string): Promise<WorkspaceSessionState> {
    this.transition({
      ...EMPTY_WORKSPACE_SESSION,
      phase: 'LOADING',
      taskId,
    });
    try {
      const [workspace, offline, versions] = await Promise.all([
        this.ports.workspace.load(taskId),
        this.ports.offline.load(taskId),
        this.ports.workspace.listVersions(taskId).catch(() => []),
      ]);
      const remote = workspaceFiles(workspace);
      if (!offline || offline.dirtyFiles.length === 0) {
        const paths = Object.keys(remote);
        this.transition({
          phase: 'READY',
          workspaceId: workspace.id ?? null,
          remoteBaseline: remote,
          fileMetadata: workspaceMetadata(workspace),
          draft: { ...remote },
          dirtyFiles: [],
          offlineSnapshot: null,
          versions,
          openFiles: paths,
          activeFile: paths[0] ?? null,
        });
        await this.ports.offline.clear(taskId);
        return this.state;
      }

      const conflicts = offline.dirtyFiles.filter((path) => {
        const baseline = offline.baselineFiles[path];
        const local = offline.draftFiles[path];
        const remoteValue = remote[path];
        const localChanged = Object.keys(offline.baselineFiles).length === 0 || local !== baseline;
        const remoteChanged =
          Object.keys(offline.baselineFiles).length === 0 || remoteValue !== baseline;
        return localChanged && remoteChanged && local !== remoteValue;
      });
      const draft = mergeDraft(remote, offline.draftFiles, offline.dirtyFiles);
      const dirty = changedFiles(remote, draft);
      this.transition({
        phase: conflicts.length > 0 ? 'CONFLICT' : 'READY',
        workspaceId: workspace.id ?? null,
        remoteBaseline: remote,
        fileMetadata: workspaceMetadata(workspace),
        draft,
        dirtyFiles: dirty,
        offlineSnapshot: offline,
        versions,
        conflict:
          conflicts.length > 0
            ? { files: conflicts, remoteFiles: remote, localFiles: offline.draftFiles }
            : null,
        openFiles: offline.openFiles.filter((path) => path in draft),
        activeFile:
          offline.activeFile && offline.activeFile in draft
            ? offline.activeFile
            : (Object.keys(draft)[0] ?? null),
      });
      if (conflicts.length === 0) await this.persistDraft();
      return this.state;
    } catch (error) {
      this.transition({
        phase: 'ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async resolveConflict(
    resolution: ConflictResolution,
    perFile: Record<string, { resolution: ConflictResolution; content?: string }> = {},
  ): Promise<void> {
    const conflict = this.state.conflict;
    if (!conflict) return;
    let draft = { ...this.state.draft };
    for (const path of conflict.files) {
      const choice = perFile[path]?.resolution ?? resolution;
      if (choice === 'REMOTE') {
        if (path in conflict.remoteFiles) draft[path] = conflict.remoteFiles[path] ?? '';
        else draft = withoutFile(draft, path);
      } else if (choice === 'LOCAL') {
        if (path in conflict.localFiles) draft[path] = conflict.localFiles[path] ?? '';
        else draft = withoutFile(draft, path);
      } else {
        const content = perFile[path]?.content;
        if (content === undefined) {
          throw new WorkspaceConflictError(`Merged content is required for ${path}`);
        }
        draft[path] = content;
      }
    }
    this.transition({
      phase: 'READY',
      conflict: null,
      draft,
      dirtyFiles: changedFiles(this.state.remoteBaseline, draft),
    });
    await this.persistDraft();
  }

  async edit(path: string, content: string): Promise<void> {
    if (this.state.phase !== 'READY') {
      throw new WorkspaceSessionError('Resolve workspace conflicts before editing');
    }
    const draft = { ...this.state.draft, [path]: content };
    this.transition({
      draft,
      dirtyFiles: changedFiles(this.state.remoteBaseline, draft),
    });
    await this.persistDraft();
  }

  open(path: string): void {
    if (!(path in this.state.draft)) return;
    this.transition({
      activeFile: path,
      openFiles: this.state.openFiles.includes(path)
        ? this.state.openFiles
        : [...this.state.openFiles, path],
      recentFiles: [path, ...this.state.recentFiles.filter((item) => item !== path)].slice(0, 5),
    });
  }

  close(path: string): void {
    const openFiles = this.state.openFiles.filter((item) => item !== path);
    this.transition({
      openFiles,
      activeFile:
        this.state.activeFile === path
          ? (openFiles[openFiles.length - 1] ?? null)
          : this.state.activeFile,
    });
  }

  setActiveFile(path: string | null): void {
    this.transition({ activeFile: path });
  }

  reorderOpenFiles(fromIndex: number, toIndex: number): void {
    const openFiles = [...this.state.openFiles];
    const [file] = openFiles.splice(fromIndex, 1);
    if (file === undefined) return;
    openFiles.splice(toIndex, 0, file);
    this.transition({ openFiles });
  }

  async save(): Promise<void> {
    if (this.savePromise) return this.savePromise;
    if (this.state.phase === 'CONFLICT') {
      throw new WorkspaceConflictError('Resolve workspace conflicts before saving');
    }
    const taskId = this.requireTask();
    const dirtyAtStart = [...this.state.dirtyFiles];
    if (dirtyAtStart.length === 0) return;
    const savedContents = Object.fromEntries(
      dirtyAtStart
        .filter((path) => path in this.state.draft)
        .map((path) => [path, this.state.draft[path] ?? '']),
    );
    this.transition({ isSaving: true });
    this.savePromise = (async () => {
      try {
        const response = await this.ports.workspace.saveFiles(
          taskId,
          Object.entries(savedContents).map(([path, content]) => ({ path, content })),
        );
        const remote = workspaceFiles(response);
        let draft = { ...remote };
        const concurrentDirty = this.state.dirtyFiles.filter(
          (path) => !dirtyAtStart.includes(path) || this.state.draft[path] !== savedContents[path],
        );
        for (const path of concurrentDirty) {
          if (path in this.state.draft) draft[path] = this.state.draft[path] ?? '';
          else draft = withoutFile(draft, path);
        }
        this.transition({
          workspaceId: response.id ?? this.state.workspaceId,
          remoteBaseline: remote,
          fileMetadata: workspaceMetadata(response),
          draft,
          dirtyFiles: changedFiles(remote, draft),
          error: null,
        });
        await this.persistDraft();
      } catch (error) {
        this.transition({ error: error instanceof Error ? error.message : String(error) });
        throw error;
      } finally {
        this.savePromise = null;
        this.transition({ isSaving: false });
      }
    })();
    return this.savePromise;
  }

  async createFile(path: string, content = ''): Promise<void> {
    await this.edit(path, content);
    this.open(path);
    await this.save();
  }

  async deleteFile(path: string): Promise<void> {
    const taskId = this.requireTask();
    const response = await this.ports.workspace.deleteFile(taskId, path);
    const remote = workspaceFiles(response);
    const draft = withoutFile(this.state.draft, path);
    this.close(path);
    this.transition({
      remoteBaseline: remote,
      fileMetadata: workspaceMetadata(response),
      draft,
      dirtyFiles: changedFiles(remote, draft),
    });
    await this.persistDraft();
  }

  async renameFile(path: string, nextPath: string): Promise<void> {
    const content = this.state.draft[path];
    if (content === undefined) throw new WorkspaceSessionError(`Unknown file: ${path}`);
    await this.createFile(nextPath, content);
    await this.deleteFile(path);
    this.open(nextPath);
  }

  async refreshVersions(): Promise<void> {
    this.transition({ versions: await this.ports.workspace.listVersions(this.requireTask()) });
  }

  async createSnapshot(trigger: 'RUN' | 'SUBMIT' | 'MANUAL'): Promise<void> {
    await this.save();
    await this.ports.workspace.createVersion(this.requireTask(), trigger);
    await this.refreshVersions();
  }

  async restoreVersion(
    versionId: string,
    dirtyPolicy: 'REJECT' | 'DISCARD' | 'KEEP_LOCAL' = 'REJECT',
  ): Promise<void> {
    if (this.state.dirtyFiles.length > 0 && dirtyPolicy === 'REJECT') {
      throw new UnsavedWorkspaceChangesError(
        'Choose whether to keep or discard local changes before restoring a version',
      );
    }
    const localDraft = { ...this.state.draft };
    const localDirty = [...this.state.dirtyFiles];
    const response = await this.ports.workspace.restoreVersion(this.requireTask(), versionId);
    const remote = workspaceFiles(response);
    const draft =
      dirtyPolicy === 'KEEP_LOCAL' ? mergeDraft(remote, localDraft, localDirty) : { ...remote };
    const paths = Object.keys(draft);
    this.transition({
      phase: 'READY',
      workspaceId: response.id ?? this.state.workspaceId,
      remoteBaseline: remote,
      fileMetadata: workspaceMetadata(response),
      draft,
      dirtyFiles: changedFiles(remote, draft),
      conflict: null,
      openFiles: this.state.openFiles.filter((path) => path in draft),
      activeFile:
        this.state.activeFile && this.state.activeFile in draft
          ? this.state.activeFile
          : (paths[0] ?? null),
    });
    await this.persistDraft();
    await this.refreshVersions();
  }

  private applyExecutionEvent(event: WorkspaceExecutionEvent): void {
    const execution = { ...this.state.execution };
    const metrics = execution.metrics ? { ...execution.metrics } : null;
    if (event.type === 'RUNNING') {
      execution.status = 'RUNNING';
      if (metrics) metrics.status = 'RUNNING';
    } else if (event.type === 'LOG' && event.data?.text) {
      execution.logs += event.data.text;
      if (metrics) metrics.logCount += 1;
    } else if (event.type === 'ERROR') {
      execution.status = 'ERROR';
      execution.error = event.message ?? 'Unknown error';
      if (metrics) metrics.status = 'ERROR';
    } else if (event.type === 'SUCCESS' || event.type === 'FAILED') {
      execution.status = event.type;
      execution.score = event.data?.score ?? 0;
      execution.report = event.data?.report ?? null;
      if (metrics) {
        metrics.status = event.type;
        metrics.exitCode = event.data?.exitCode ?? null;
      }
    }
    execution.metrics = metrics;
    this.transition({ execution });
  }

  private async execute(kind: 'RUN' | 'SUBMIT', action?: SandboxAction): Promise<void> {
    await this.createSnapshot(kind);
    const startTime = this.ports.now?.() ?? Date.now();
    this.transition({
      execution: {
        ...EMPTY_EXECUTION,
        status: 'PENDING',
        metrics: {
          executionId: 'pending',
          status: 'PENDING',
          startTime,
          endTime: null,
          durationMs: 0,
          stageDurations: {},
          exitCode: null,
          retryCount: 0,
          logCount: 0,
        },
      },
    });
    try {
      const executionId =
        kind === 'SUBMIT'
          ? await this.ports.execution.submit(this.requireTask(), (event) => {
              this.applyExecutionEvent(event);
            })
          : await this.ports.execution.run(this.requireTask(), action ?? 'run', (event) => {
              this.applyExecutionEvent(event);
            });
      const endTime = this.ports.now?.() ?? Date.now();
      const execution = {
        ...this.state.execution,
        submissionId: kind === 'SUBMIT' ? executionId : null,
        metrics: this.state.execution.metrics
          ? {
              ...this.state.execution.metrics,
              executionId,
              endTime,
              durationMs: endTime - startTime,
            }
          : null,
      };
      this.transition({ execution });
    } catch (error) {
      const endTime = this.ports.now?.() ?? Date.now();
      this.transition({
        execution: {
          ...this.state.execution,
          status: 'ERROR',
          error: error instanceof Error ? error.message : String(error),
          metrics: this.state.execution.metrics
            ? {
                ...this.state.execution.metrics,
                status: 'ERROR',
                endTime,
                durationMs: endTime - startTime,
              }
            : null,
        },
      });
      throw error;
    }
  }

  async run(action: SandboxAction): Promise<void> {
    await this.execute('RUN', action);
  }

  async submit(): Promise<void> {
    await this.execute('SUBMIT');
  }

  clear(): void {
    this.state = EMPTY_WORKSPACE_SESSION;
    this.listeners.forEach((listener) => {
      listener();
    });
  }
}
