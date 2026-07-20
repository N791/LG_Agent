type WorkspaceShortcutAction =
  | { type: 'switch-left-panel'; tab: 'objective' | 'mentor' | 'versions' }
  | { type: 'cycle-editor-theme'; nextTheme: string };

export const WORKSPACE_LOCALE_LABELS = {
  objective: 'Task objective',
  mentor: 'AI mentor',
  versions: 'Version history',
  'vs-dark': 'Dark theme',
  'vs-light': 'Light theme',
  'hc-black': 'High contrast theme',
} as const;

const THEME_CYCLE = ['vs-dark', 'vs-light', 'hc-black'];

export function resolveWorkspaceKeyboardShortcut(
  event: KeyboardEvent,
  currentTheme: string,
): WorkspaceShortcutAction | null {
  if (event.altKey && ['1', '2', '3'].includes(event.key)) {
    const tabMap: Record<string, 'objective' | 'mentor' | 'versions'> = {
      '1': 'objective',
      '2': 'mentor',
      '3': 'versions',
    };

    const tab = tabMap[event.key];
    if (tab) {
      return { type: 'switch-left-panel', tab };
    }
  }

  if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 't') {
    const currentIndex = THEME_CYCLE.indexOf(currentTheme);
    const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % THEME_CYCLE.length : 0;
    const nextTheme = THEME_CYCLE[nextIndex];
    if (nextTheme) {
      return { type: 'cycle-editor-theme', nextTheme };
    }
  }

  return null;
}
