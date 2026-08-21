import { useCallback, useEffect } from 'react';
import { useWorkspaceSession, workspaceSessionCommands } from './runtime';

interface WorkspaceAutoSaveOptions {
  debounceMs?: number;
}

export function useWorkspaceAutoSave(
  taskId: string | undefined,
  options: WorkspaceAutoSaveOptions = {},
): { saveNow: () => Promise<void>; isSaving: boolean } {
  const { debounceMs = 1500 } = options;
  const dirtyFiles = useWorkspaceSession((state) => state.dirtyFiles);
  const isSaving = useWorkspaceSession((state) => state.isSaving);

  const saveNow = useCallback(async () => {
    if (!taskId || workspaceSessionCommands.getState().taskId !== taskId) return;
    await workspaceSessionCommands.save();
  }, [taskId]);

  useEffect(() => {
    const handler = setTimeout(() => {
      void saveNow().catch((error: unknown) => {
        console.error('Auto save failed', error);
      });
    }, debounceMs);
    return () => {
      clearTimeout(handler);
    };
  }, [dirtyFiles, saveNow, debounceMs]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        void saveNow().catch((error: unknown) => {
          console.error('Manual save failed', error);
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [saveNow]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      void saveNow().catch(() => {
        // Edits are already durable in the session's offline snapshot.
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [saveNow]);

  return { saveNow, isSaving };
}
