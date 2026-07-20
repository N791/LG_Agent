import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspaceStore } from '../store/workspaceStore';
import { workspaceService } from '../services/workspace/WorkspaceService';
import { offlineWorkspaceService } from '../services/offlineWorkspaceService';

interface UseAutoSaveOptions {
  /** Debounce interval in ms. Default: 1500 */
  debounceMs?: number;
}

interface UseAutoSaveReturn {
  /** Trigger an immediate save of all unsaved files */
  saveNow: () => Promise<void>;
  /** Whether a save is currently in progress */
  isSaving: boolean;
}

/**
 * Encapsulates the workspace draft auto-save lifecycle:
 * - Debounced auto-save on content changes
 * - Ctrl/Cmd+S manual save
 * - beforeunload save
 *
 * @param taskId - The current workspace task ID
 * @param options - Configuration options
 */
export function useAutoSave(
  taskId: string | undefined,
  options: UseAutoSaveOptions = {},
): UseAutoSaveReturn {
  const { debounceMs = 1500 } = options;
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const unsavedChanges = useWorkspaceStore((state) => state.unsavedChanges);
  const fileContents = useWorkspaceStore((state) => state.fileContents);

  const saveNow = useCallback(async () => {
    if (!taskId) return;
    // Avoid concurrent saves
    if (savingRef.current) return;

    const currentUnsaved = useWorkspaceStore.getState().unsavedChanges;
    const currentContents = useWorkspaceStore.getState().fileContents;
    const filesToSave = Object.keys(currentUnsaved).filter((p) => currentUnsaved[p]);
    if (filesToSave.length === 0) return;

    savingRef.current = true;
    setIsSaving(true);

    const payload = filesToSave.map((path) => ({
      path,
      content: currentContents[path] ?? '',
    }));

    try {
      await workspaceService.updateFiles(taskId, payload);
      await offlineWorkspaceService.syncWithRemote(taskId, payload);
      filesToSave.forEach((path) => {
        useWorkspaceStore.getState().markFileSaved(path);
      });
    } catch (err) {
      console.error('Auto save failed', err);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }, [taskId]);

  // ---- Debounce Auto Save ----
  useEffect(() => {
    const handler = setTimeout(() => {
      void saveNow();
    }, debounceMs);
    return () => {
      clearTimeout(handler);
    };
    // Re-trigger whenever unsavedChanges or fileContents change
  }, [unsavedChanges, fileContents, saveNow, debounceMs]);

  // ---- Ctrl/Cmd+S Manual Save ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void saveNow();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveNow]);

  // ---- beforeunload Save ----
  useEffect(() => {
    const handleBeforeUnload = () => {
      void saveNow();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveNow]);

  return { saveNow, isSaving };
}
