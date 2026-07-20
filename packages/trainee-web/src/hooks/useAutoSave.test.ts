import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAutoSave } from './useAutoSave';
import { useWorkspaceStore } from '../store/workspaceStore';
import { workspaceService } from '../services/workspace/WorkspaceService';

// Mock workspaceService
vi.mock('../services/workspace/WorkspaceService', () => ({
  workspaceService: {
    updateFiles: vi.fn().mockResolvedValue(undefined),
    loadWorkspace: vi.fn(),
    writeFile: vi.fn(),
    createVersion: vi.fn(),
    getVersions: vi.fn(),
    restoreVersion: vi.fn(),
  },
}));

describe('useAutoSave', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset workspace store to a clean state
    useWorkspaceStore.setState({
      taskId: 'test-task',
      activeFile: null,
      openFiles: [],
      recentFiles: [],
      fileContents: {},
      unsavedChanges: {},
      leftPanelTab: 'objective',
      aiFeedback: '',
      aiLoading: false,
      aiHistory: [],
      editorTheme: 'vs-dark',
      cursorPositions: {},
      editorLayoutSizes: { leftPanel: 25, fileTree: 15, editor: 60, logs: 30 },
    });
  });

  it('should not save when there are no unsaved changes', async () => {
    const { result } = renderHook(() => useAutoSave('test-task'));

    await act(async () => {
      await result.current.saveNow();
    });

    expect(workspaceService.updateFiles).not.toHaveBeenCalled();
  });

  it('should save unsaved files when saveNow is called', async () => {
    // Set up unsaved changes in the store
    useWorkspaceStore.setState({
      openFiles: ['src/index.ts'],
      fileContents: { 'src/index.ts': 'console.log("hello")' },
      unsavedChanges: { 'src/index.ts': true },
    });

    const { result } = renderHook(() => useAutoSave('test-task'));

    await act(async () => {
      await result.current.saveNow();
    });

    expect(workspaceService.updateFiles).toHaveBeenCalledWith('test-task', [
      { path: 'src/index.ts', content: 'console.log("hello")' },
    ]);
  });

  it('should mark files as saved after successful save', async () => {
    useWorkspaceStore.setState({
      openFiles: ['src/app.ts'],
      fileContents: { 'src/app.ts': 'const x = 1;' },
      unsavedChanges: { 'src/app.ts': true },
    });

    const { result } = renderHook(() => useAutoSave('test-task'));

    await act(async () => {
      await result.current.saveNow();
    });

    const state = useWorkspaceStore.getState();
    expect(state.unsavedChanges['src/app.ts']).toBe(false);
  });

  it('should debounce auto-save after content changes', async () => {
    useWorkspaceStore.setState({
      openFiles: ['file.ts'],
      fileContents: { 'file.ts': 'v1' },
      unsavedChanges: { 'file.ts': true },
    });

    renderHook(() => useAutoSave('test-task', { debounceMs: 50 }));

    // Not called immediately
    expect(workspaceService.updateFiles).not.toHaveBeenCalled();

    // Advance past debounce
    await new Promise((r) => setTimeout(r, 100));

    await waitFor(() => {
      expect(workspaceService.updateFiles).toHaveBeenCalledTimes(1);
    });
  });

  it('should trigger save on Ctrl+S keydown', async () => {
    useWorkspaceStore.setState({
      openFiles: ['file.ts'],
      fileContents: { 'file.ts': 'code' },
      unsavedChanges: { 'file.ts': true },
    });

    renderHook(() => useAutoSave('test-task'));

    await act(async () => {
      const event = new KeyboardEvent('keydown', {
        key: 's',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);
    });

    // Need to wait for the async saveNow to complete
    await waitFor(() => {
      expect(workspaceService.updateFiles).toHaveBeenCalled();
    });
  });

  it('should not save when taskId is undefined', async () => {
    useWorkspaceStore.setState({
      openFiles: ['file.ts'],
      fileContents: { 'file.ts': 'code' },
      unsavedChanges: { 'file.ts': true },
    });

    const { result } = renderHook(() => useAutoSave(undefined));

    await act(async () => {
      await result.current.saveNow();
    });

    expect(workspaceService.updateFiles).not.toHaveBeenCalled();
  });

  it('should handle save errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(workspaceService.updateFiles).mockRejectedValueOnce(new Error('Network error'));

    useWorkspaceStore.setState({
      openFiles: ['file.ts'],
      fileContents: { 'file.ts': 'code' },
      unsavedChanges: { 'file.ts': true },
    });

    const { result } = renderHook(() => useAutoSave('test-task'));

    await act(async () => {
      await result.current.saveNow();
    });

    expect(consoleSpy).toHaveBeenCalledWith('Auto save failed', expect.any(Error));
    // File should still be marked as unsaved
    expect(useWorkspaceStore.getState().unsavedChanges['file.ts']).toBe(true);
    consoleSpy.mockRestore();
  });

  it('should report isSaving status correctly', async () => {
    let resolvePromise: () => void;
    vi.mocked(workspaceService.updateFiles).mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = () => resolve(undefined as never);
      }),
    );

    useWorkspaceStore.setState({
      openFiles: ['file.ts'],
      fileContents: { 'file.ts': 'code' },
      unsavedChanges: { 'file.ts': true },
    });

    const { result } = renderHook(() => useAutoSave('test-task'));

    expect(result.current.isSaving).toBe(false);

    let savePromise: Promise<void>;
    act(() => {
      savePromise = result.current.saveNow();
    });

    // Should be saving now
    await waitFor(() => {
      expect(result.current.isSaving).toBe(true);
    });

    // Resolve the save
    await act(async () => {
      resolvePromise!();
      await savePromise!;
    });

    expect(result.current.isSaving).toBe(false);
  });
});
