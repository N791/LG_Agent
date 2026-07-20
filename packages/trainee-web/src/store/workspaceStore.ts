import { create } from 'zustand';

// ---- localStorage helper keys ----
const EDITOR_PREFS_KEY = 'lg_editor_preferences';

interface EditorPreferences {
  editorTheme: string;
  editorLayoutSizes: { leftPanel: number; fileTree: number; editor: number; logs: number };
}

function loadEditorPreferences(): Partial<EditorPreferences> {
  try {
    const raw = localStorage.getItem(EDITOR_PREFS_KEY);
    if (raw) return JSON.parse(raw) as Partial<EditorPreferences>;
  } catch {
    // ignore
  }
  return {};
}

function saveEditorPreferences(prefs: EditorPreferences): void {
  localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify(prefs));
}

function loadCursorPositions(taskId: string): Record<string, { lineNumber: number; column: number }> {
  try {
    const raw = localStorage.getItem(`lg_cursor_positions_${taskId}`);
    if (raw) return JSON.parse(raw) as Record<string, { lineNumber: number; column: number }>;
  } catch {
    // ignore
  }
  return {};
}

function saveCursorPositions(taskId: string, positions: Record<string, { lineNumber: number; column: number }>): void {
  localStorage.setItem(`lg_cursor_positions_${taskId}`, JSON.stringify(positions));
}

import { ConversationMessageDTO } from '@lg-agent/contracts';
import { offlineWorkspaceService } from '../services/offlineWorkspaceService';

// ---- Store Interface ----
interface WorkspaceState {
  taskId: string | null;
  setTaskId: (taskId: string | null) => void;
  activeFile: string | null;
  openFiles: string[];
  recentFiles: string[];
  fileContents: Record<string, string>;
  unsavedChanges: Record<string, boolean>;
  setActiveFile: (path: string | null) => void;
  openFile: (path: string, content: string) => void;
  closeFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  markFileSaved: (path: string) => void;
  leftPanelTab: 'objective' | 'mentor' | 'versions';
  setLeftPanelTab: (tab: 'objective' | 'mentor' | 'versions') => void;
  aiFeedback: string;
  aiLoading: boolean;
  aiHistory: ConversationMessageDTO[];
  setAiFeedback: (feedback: string | ((prev: string) => string)) => void;
  setAiLoading: (loading: boolean) => void;
  setAiHistory: (history: ConversationMessageDTO[]) => void;
  appendAiMessage: (message: ConversationMessageDTO) => void;

  // Epic 43: Editor Enhancement
  editorTheme: string;
  setEditorTheme: (theme: string) => void;
  cursorPositions: Record<string, { lineNumber: number; column: number }>;
  setCursorPosition: (path: string, position: { lineNumber: number; column: number }) => void;
  editorLayoutSizes: { leftPanel: number; fileTree: number; editor: number; logs: number };
  setEditorLayoutSizes: (sizes: Partial<{ leftPanel: number; fileTree: number; editor: number; logs: number }>) => void;
  reorderOpenFiles: (fromIndex: number, toIndex: number) => void;

  clearWorkspace: () => void;
}

// Load persisted preferences
const savedPrefs = loadEditorPreferences();

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  taskId: null,
  setTaskId: (taskId) => {
    const cursors = taskId ? loadCursorPositions(taskId) : {};
    set({ taskId, cursorPositions: cursors });
  },
  activeFile: null,
  openFiles: [],
  recentFiles: [],
  fileContents: {},
  unsavedChanges: {},
  leftPanelTab: 'objective',
  aiFeedback: '',
  aiLoading: false,
  aiHistory: [],

  // Epic 43: Editor state
  editorTheme: savedPrefs.editorTheme ?? 'vs-dark',
  cursorPositions: {},
  editorLayoutSizes: savedPrefs.editorLayoutSizes ?? { leftPanel: 25, fileTree: 15, editor: 70, logs: 30 },

  setEditorTheme: (theme) => {
    set({ editorTheme: theme });
    const state = get();
    saveEditorPreferences({
      editorTheme: theme,
      editorLayoutSizes: state.editorLayoutSizes,
    });
  },
  setCursorPosition: (path, position) => {
    set((state) => {
      const newPositions = { ...state.cursorPositions, [path]: position };
      if (state.taskId) {
        saveCursorPositions(state.taskId, newPositions);
      }
      return { cursorPositions: newPositions };
    });
  },
  setEditorLayoutSizes: (sizes) => {
    set((state) => {
      const newSizes = { ...state.editorLayoutSizes, ...sizes };
      saveEditorPreferences({
        editorTheme: state.editorTheme,
        editorLayoutSizes: newSizes,
      });
      return { editorLayoutSizes: newSizes };
    });
  },
  reorderOpenFiles: (fromIndex, toIndex) => {
    set((state) => {
      const newFiles = [...state.openFiles];
      const [moved] = newFiles.splice(fromIndex, 1);
      if (moved !== undefined) {
        newFiles.splice(toIndex, 0, moved);
      }
      return { openFiles: newFiles };
    });
  },

  setLeftPanelTab: (tab) => {
    set({ leftPanelTab: tab });
  },
  setAiFeedback: (feedback) => {
    set((state) => ({
      aiFeedback: typeof feedback === 'function' ? feedback(state.aiFeedback) : feedback,
    }));
  },
  setAiLoading: (loading) => {
    set({ aiLoading: loading });
  },
  setAiHistory: (history) => {
    set({ aiHistory: history });
  },
  appendAiMessage: (message) => {
    set((state) => ({ aiHistory: [...state.aiHistory, message] }));
  },
  setActiveFile: (path) => {
    set({ activeFile: path });
  },
  openFile: (path, content) => {
    set((state) => {
      const newRecent = [path, ...state.recentFiles.filter(p => p !== path)].slice(0, 5);

      if (state.openFiles.includes(path)) {
        return { activeFile: path, recentFiles: newRecent };
      }
      return {
        openFiles: [...state.openFiles, path],
        fileContents: { ...state.fileContents, [path]: content },
        activeFile: path,
        recentFiles: newRecent,
      };
    });
  },
  closeFile: (path) => {
    set((state) => {
      const newOpenFiles = state.openFiles.filter((p) => p !== path);
      const newActiveFile =
        state.activeFile === path
          ? newOpenFiles.length > 0
            ? newOpenFiles[newOpenFiles.length - 1]
            : null
          : state.activeFile;
      const { [path]: _, ...newFileContents } = state.fileContents;
      const { [path]: __, ...newUnsavedChanges } = state.unsavedChanges;
      return {
        openFiles: newOpenFiles,
        activeFile: newActiveFile,
        fileContents: newFileContents,
        unsavedChanges: newUnsavedChanges,
      };
    });
  },
  updateFileContent: (path, content) => {
    set((state) => {
      const newContents = { ...state.fileContents, [path]: content };
      const newUnsaved = { ...state.unsavedChanges, [path]: true };

      if (state.taskId) {
        localStorage.setItem(
          `lg_workspace_recovery_${state.taskId}`,
          JSON.stringify(newContents)
        );
        void offlineWorkspaceService.saveSnapshot(state.taskId, {
          activeFile: state.activeFile,
          openFiles: state.openFiles,
          fileContents: newContents,
          unsavedChanges: newUnsaved,
        });
      }

      return {
        fileContents: newContents,
        unsavedChanges: newUnsaved,
      };
    });
  },
  markFileSaved: (path) => {
    set((state) => {
      const newUnsaved = { ...state.unsavedChanges, [path]: false };

      // If no files have unsaved changes, clear local recovery cache
      if (state.taskId && !Object.values(newUnsaved).some(Boolean)) {
        localStorage.removeItem(`lg_workspace_recovery_${state.taskId}`);
        void offlineWorkspaceService.clearSnapshot(state.taskId);
      }

      return {
        unsavedChanges: newUnsaved,
      };
    });
  },
  clearWorkspace: () => {
    set({
      taskId: null,
      activeFile: null,
      openFiles: [],
      recentFiles: [],
      fileContents: {},
      unsavedChanges: {},
      cursorPositions: {},
      leftPanelTab: 'objective',
      aiFeedback: '',
      aiLoading: false,
      aiHistory: [],
      // Note: editorTheme and editorLayoutSizes are NOT reset — they are user preferences
    });
  },
}));
