import { describe, expect, it } from 'vitest';
import { resolveWorkspaceKeyboardShortcut } from './workspaceKeyboardShortcuts';

describe('resolveWorkspaceKeyboardShortcut', () => {
  it('switches the left panel tab for Alt+1/2/3 shortcuts', () => {
    expect(resolveWorkspaceKeyboardShortcut({ key: '1', altKey: true } as KeyboardEvent, 'vs-dark')).toEqual({
      type: 'switch-left-panel',
      tab: 'objective',
    });

    expect(resolveWorkspaceKeyboardShortcut({ key: '2', altKey: true } as KeyboardEvent, 'vs-dark')).toEqual({
      type: 'switch-left-panel',
      tab: 'mentor',
    });

    expect(resolveWorkspaceKeyboardShortcut({ key: '3', altKey: true } as KeyboardEvent, 'vs-dark')).toEqual({
      type: 'switch-left-panel',
      tab: 'versions',
    });
  });

  it('cycles the editor theme for Ctrl+Shift+T', () => {
    expect(resolveWorkspaceKeyboardShortcut({ key: 'T', ctrlKey: true, shiftKey: true } as KeyboardEvent, 'vs-dark')).toEqual({
      type: 'cycle-editor-theme',
      nextTheme: 'vs-light',
    });
  });
});
