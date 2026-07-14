import { create } from 'zustand';

interface WorkspaceState {
  activeFile: string | null;
  openFiles: string[];
  fileContents: Record<string, string>;
  unsavedChanges: Record<string, boolean>;
  setActiveFile: (path: string | null) => void;
  openFile: (path: string, content: string) => void;
  closeFile: (path: string) => void;
  updateFileContent: (path: string, content: string) => void;
  markFileSaved: (path: string) => void;
  leftPanelTab: 'objective' | 'mentor';
  setLeftPanelTab: (tab: 'objective' | 'mentor') => void;
  aiFeedback: string;
  aiLoading: boolean;
  aiHistory: { id: string; role: string; content: string }[];
  setAiFeedback: (feedback: string | ((prev: string) => string)) => void;
  setAiLoading: (loading: boolean) => void;
  setAiHistory: (history: { id: string; role: string; content: string }[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activeFile: null,
  openFiles: [],
  fileContents: {},
  unsavedChanges: {},
  leftPanelTab: 'objective',
  aiFeedback: '',
  aiLoading: false,
  aiHistory: [],
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
  setActiveFile: (path) => {
    set({ activeFile: path });
  },
  openFile: (path, content) => {
    set((state) => {
      if (state.openFiles.includes(path)) {
        return { activeFile: path };
      }
      return {
        openFiles: [...state.openFiles, path],
        fileContents: { ...state.fileContents, [path]: content },
        activeFile: path,
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
    set((state) => ({
      fileContents: { ...state.fileContents, [path]: content },
      unsavedChanges: { ...state.unsavedChanges, [path]: true },
    }));
  },
  markFileSaved: (path) => {
    set((state) => ({
      unsavedChanges: { ...state.unsavedChanges, [path]: false },
    }));
  },
}));
