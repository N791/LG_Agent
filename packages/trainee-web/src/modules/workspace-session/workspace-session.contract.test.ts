import { describe, expect, it, vi } from 'vitest';
import type {
  SandboxAction,
  WorkspaceDTO,
  WorkspaceFileDTO,
  WorkspaceVersionDTO,
} from '@lg-agent/contracts';
import type { AuthoringWorkspacePort, OfflineSnapshotPort, WorkspaceExecutionPort } from './ports';
import type { WorkspaceExecutionEvent, WorkspaceOfflineSnapshot } from './model';
import { UnsavedWorkspaceChangesError, WorkspaceSession } from './workspace-session';

function dto(files: Record<string, string>): WorkspaceDTO {
  return {
    id: 'workspace-1',
    taskId: 'task-1',
    workspace: {
      entry: 'src/index.ts',
      files: Object.entries(files).map(([path, content]) => ({ path, content })),
    },
  };
}

class MemoryWorkspaceAdapter implements AuthoringWorkspacePort {
  files: Record<string, string>;
  versions: WorkspaceVersionDTO[] = [];
  readonly savedPayloads: Pick<WorkspaceFileDTO, 'path' | 'content'>[][] = [];
  readonly createdTriggers: string[] = [];
  restoreFiles: Record<string, string> = {};

  constructor(files: Record<string, string>) {
    this.files = { ...files };
  }

  load(): Promise<WorkspaceDTO> {
    return Promise.resolve(dto(this.files));
  }

  saveFiles(
    _taskId: string,
    files: Pick<WorkspaceFileDTO, 'path' | 'content'>[],
  ): Promise<WorkspaceDTO> {
    this.savedPayloads.push(files);
    for (const file of files) this.files[file.path] = file.content;
    return Promise.resolve(dto(this.files));
  }

  deleteFile(_taskId: string, path: string): Promise<WorkspaceDTO> {
    this.files = Object.fromEntries(
      Object.entries(this.files).filter(([filePath]) => filePath !== path),
    );
    return Promise.resolve(dto(this.files));
  }

  createVersion(_taskId: string, trigger: string): Promise<void> {
    this.createdTriggers.push(trigger);
    return Promise.resolve();
  }

  listVersions(): Promise<WorkspaceVersionDTO[]> {
    return Promise.resolve(this.versions);
  }

  restoreVersion(): Promise<WorkspaceDTO> {
    this.files = { ...this.restoreFiles };
    return Promise.resolve(dto(this.files));
  }
}

class MemoryOfflineAdapter implements OfflineSnapshotPort {
  value: WorkspaceOfflineSnapshot | null;
  saves = 0;
  clears = 0;

  constructor(value: WorkspaceOfflineSnapshot | null = null) {
    this.value = value;
  }

  load(): Promise<WorkspaceOfflineSnapshot | null> {
    return Promise.resolve(this.value);
  }

  save(snapshot: WorkspaceOfflineSnapshot): Promise<void> {
    this.value = structuredClone(snapshot);
    this.saves += 1;
    return Promise.resolve();
  }

  clear(): Promise<void> {
    this.value = null;
    this.clears += 1;
    return Promise.resolve();
  }
}

class MemoryExecutionAdapter implements WorkspaceExecutionPort {
  submitCalls = 0;

  run(
    _taskId: string,
    _action: SandboxAction,
    onEvent: (event: WorkspaceExecutionEvent) => void,
  ): Promise<string> {
    onEvent({ type: 'RUNNING' });
    onEvent({ type: 'SUCCESS', data: { score: 100, exitCode: 0 } });
    return Promise.resolve('execution-1');
  }

  submit(_taskId: string, onEvent: (event: WorkspaceExecutionEvent) => void): Promise<string> {
    this.submitCalls += 1;
    onEvent({ type: 'RUNNING' });
    onEvent({ type: 'LOG', data: { text: 'passed\n' } });
    onEvent({ type: 'SUCCESS', data: { score: 95, exitCode: 0 } });
    return Promise.resolve('submission-1');
  }
}

function createSession(
  remote: Record<string, string>,
  offlineValue: WorkspaceOfflineSnapshot | null = null,
) {
  const workspace = new MemoryWorkspaceAdapter(remote);
  const offline = new MemoryOfflineAdapter(offlineValue);
  const execution = new MemoryExecutionAdapter();
  let time = 1_000;
  const session = new WorkspaceSession({
    workspace,
    offline,
    execution,
    now: () => (time += 100),
  });
  return { session, workspace, offline, execution };
}

function snapshot(
  baselineFiles: Record<string, string>,
  draftFiles: Record<string, string>,
  dirtyFiles: string[],
): WorkspaceOfflineSnapshot {
  return {
    schemaVersion: 2,
    taskId: 'task-1',
    baselineFiles,
    draftFiles,
    dirtyFiles,
    activeFile: 'src/index.ts',
    openFiles: ['src/index.ts'],
    updatedAt: '2026-07-27T00:00:00.000Z',
  };
}

describe('WorkspaceSession contract', () => {
  it('loads the remote baseline into a clean first session', async () => {
    const { session } = createSession({ 'src/index.ts': 'remote' });

    await session.load('task-1');

    expect(session.getState()).toMatchObject({
      phase: 'READY',
      remoteBaseline: { 'src/index.ts': 'remote' },
      draft: { 'src/index.ts': 'remote' },
      dirtyFiles: [],
      activeFile: 'src/index.ts',
    });
  });

  it('recovers a local draft when the remote baseline has not changed', async () => {
    const local = snapshot({ 'src/index.ts': 'base' }, { 'src/index.ts': 'local edit' }, [
      'src/index.ts',
    ]);
    const { session } = createSession({ 'src/index.ts': 'base' }, local);

    await session.load('task-1');

    expect(session.getState().phase).toBe('READY');
    expect(session.getState().draft['src/index.ts']).toBe('local edit');
    expect(session.getState().dirtyFiles).toEqual(['src/index.ts']);
  });

  it('requires explicit per-file conflict resolution and supports merged content', async () => {
    const local = snapshot({ 'src/index.ts': 'base' }, { 'src/index.ts': 'local edit' }, [
      'src/index.ts',
    ]);
    const { session } = createSession({ 'src/index.ts': 'remote edit' }, local);

    await session.load('task-1');
    expect(session.getState().phase).toBe('CONFLICT');
    expect(session.getState().conflict?.files).toEqual(['src/index.ts']);

    await session.resolveConflict('MERGED', {
      'src/index.ts': { resolution: 'MERGED', content: 'merged edit' },
    });

    expect(session.getState().phase).toBe('READY');
    expect(session.getState().draft['src/index.ts']).toBe('merged edit');
    expect(session.getState().dirtyFiles).toEqual(['src/index.ts']);
  });

  it('auto-save persists dirty files, advances the baseline, and clears recovery data', async () => {
    const { session, workspace, offline } = createSession({ 'src/index.ts': 'base' });
    await session.load('task-1');

    await session.edit('src/index.ts', 'saved edit');
    expect(offline.value?.draftFiles['src/index.ts']).toBe('saved edit');
    await session.save();

    expect(workspace.savedPayloads).toEqual([[{ path: 'src/index.ts', content: 'saved edit' }]]);
    expect(session.getState().remoteBaseline['src/index.ts']).toBe('saved edit');
    expect(session.getState().dirtyFiles).toEqual([]);
    expect(offline.value).toBeNull();
  });

  it('protects dirty drafts during version rollback and can keep them explicitly', async () => {
    const { session, workspace } = createSession({ 'src/index.ts': 'base' });
    workspace.restoreFiles = { 'src/index.ts': 'old version' };
    await session.load('task-1');
    await session.edit('src/index.ts', 'local edit');

    await expect(session.restoreVersion('version-1')).rejects.toBeInstanceOf(
      UnsavedWorkspaceChangesError,
    );
    await session.restoreVersion('version-1', 'KEEP_LOCAL');

    expect(session.getState().remoteBaseline['src/index.ts']).toBe('old version');
    expect(session.getState().draft['src/index.ts']).toBe('local edit');
    expect(session.getState().dirtyFiles).toEqual(['src/index.ts']);
  });

  it('submits only after save and snapshot, then owns the execution result', async () => {
    const { session, workspace, execution } = createSession({ 'src/index.ts': 'base' });
    const saveSpy = vi.spyOn(workspace, 'saveFiles');
    await session.load('task-1');
    await session.edit('src/index.ts', 'ready');

    await session.submit();

    expect(saveSpy).toHaveBeenCalledOnce();
    expect(workspace.createdTriggers).toEqual(['SUBMIT']);
    expect(execution.submitCalls).toBe(1);
    expect(session.getState().execution).toMatchObject({
      submissionId: 'submission-1',
      status: 'SUCCESS',
      score: 95,
      logs: 'passed\n',
    });
  });
});
