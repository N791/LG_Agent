import { create } from 'zustand';
import type { ConversationMessageDTO } from '@lg-agent/contracts';

const EDITOR_PREFS_KEY = 'lg_editor_preferences';

interface EditorPreferences {
  editorTheme: string;
  editorLayoutSizes: { leftPanel: number; fileTree: number; editor: number; logs: number };
}

function loadEditorPreferences(): Partial<EditorPreferences> {
  try {
    const raw = localStorage.getItem(EDITOR_PREFS_KEY);
    return raw ? (JSON.parse(raw) as Partial<EditorPreferences>) : {};
  } catch {
    return {};
  }
}

function saveEditorPreferences(preferences: EditorPreferences): void {
  localStorage.setItem(EDITOR_PREFS_KEY, JSON.stringify(preferences));
}

function loadCursorPositions(
  taskId: string,
): Record<string, { lineNumber: number; column: number }> {
  try {
    const raw = localStorage.getItem(`lg_cursor_positions_${taskId}`);
    return raw ? (JSON.parse(raw) as Record<string, { lineNumber: number; column: number }>) : {};
  } catch {
    return {};
  }
}

interface WorkspaceUiState {
  taskId: string | null;
  setTaskId: (taskId: string | null) => void;
  leftPanelTab:
    'explorer' | 'objective' | 'mentor' | 'versions' | 'submissions' | 'knowledge' | 'mentor-human';
  setLeftPanelTab: (tab: WorkspaceUiState['leftPanelTab']) => void;
  aiFeedback: string;
  aiLoading: boolean;
  aiHistory: ConversationMessageDTO[];
  setAiFeedback: (feedback: string | ((previous: string) => string)) => void;
  setAiLoading: (loading: boolean) => void;
  setAiHistory: (history: ConversationMessageDTO[]) => void;
  appendAiMessage: (message: ConversationMessageDTO) => void;
  editorTheme: string;
  setEditorTheme: (theme: string) => void;
  cursorPositions: Record<string, { lineNumber: number; column: number }>;
  setCursorPosition: (path: string, position: { lineNumber: number; column: number }) => void;
  editorLayoutSizes: EditorPreferences['editorLayoutSizes'];
  setEditorLayoutSizes: (sizes: Partial<EditorPreferences['editorLayoutSizes']>) => void;
  clearWorkspace: () => void;
}

const savedPreferences = loadEditorPreferences();

export const useWorkspaceStore = create<WorkspaceUiState>((set, get) => ({
  taskId: null,
  setTaskId: (taskId) => {
    set({ taskId, cursorPositions: taskId ? loadCursorPositions(taskId) : {} });
  },
  leftPanelTab: 'explorer',
  setLeftPanelTab: (leftPanelTab) => {
    set({ leftPanelTab });
  },
  aiFeedback: '',
  aiLoading: false,
  aiHistory: [],
  setAiFeedback: (feedback) => {
    set((state) => ({
      aiFeedback: typeof feedback === 'function' ? feedback(state.aiFeedback) : feedback,
    }));
  },
  setAiLoading: (aiLoading) => {
    set({ aiLoading });
  },
  setAiHistory: (aiHistory) => {
    set({ aiHistory });
  },
  appendAiMessage: (message) => {
    set((state) => ({ aiHistory: [...state.aiHistory, message] }));
  },
  editorTheme: savedPreferences.editorTheme ?? 'vs-dark',
  setEditorTheme: (editorTheme) => {
    set({ editorTheme });
    saveEditorPreferences({ editorTheme, editorLayoutSizes: get().editorLayoutSizes });
  },
  cursorPositions: {},
  setCursorPosition: (path, position) => {
    set((state) => {
      const cursorPositions = { ...state.cursorPositions, [path]: position };
      if (state.taskId) {
        localStorage.setItem(
          `lg_cursor_positions_${state.taskId}`,
          JSON.stringify(cursorPositions),
        );
      }
      return { cursorPositions };
    });
  },
  editorLayoutSizes: savedPreferences.editorLayoutSizes ?? {
    leftPanel: 20,
    fileTree: 15,
    editor: 65,
    logs: 25,
  },
  setEditorLayoutSizes: (sizes) => {
    set((state) => {
      const editorLayoutSizes = { ...state.editorLayoutSizes, ...sizes };
      saveEditorPreferences({ editorTheme: state.editorTheme, editorLayoutSizes });
      return { editorLayoutSizes };
    });
  },
  clearWorkspace: () => {
    set({
      taskId: null,
      cursorPositions: {},
      leftPanelTab: 'explorer',
      aiFeedback: '',
      aiLoading: false,
      aiHistory: [],
    });
  },
}));
