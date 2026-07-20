import React, { useRef, useCallback, useEffect } from 'react';
import Editor, { OnMount, loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

// Configure Monaco Environment for local workers
self.MonacoEnvironment = {
  getWorker(_, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  },
};

// Configure @monaco-editor/react to use local monaco instance instead of CDN
loader.config({ monaco });
import { useWorkspaceStore } from '../../store/workspaceStore';
import { workspaceService } from '../../services/workspace/WorkspaceService';
import { Breadcrumb, Dropdown, Tooltip } from 'antd';
import {
  FileOutlined,
  CloseOutlined,
  BgColorsOutlined,
  CodeOutlined,
} from '@ant-design/icons';
import { resolveWorkspaceKeyboardShortcut } from '../../utils/workspaceKeyboardShortcuts';

// ---- File icon helper ----
const getFileIcon = (filename: string): React.ReactNode => {
  const ext = filename.split('.').pop()?.toLowerCase();
  const colorMap: Record<string, string> = {
    ts: '#3178c6',
    tsx: '#3178c6',
    js: '#f0db4f',
    jsx: '#f0db4f',
    json: '#5b9a32',
    css: '#264de4',
    html: '#e34c26',
    md: '#888',
  };
  const color = colorMap[ext ?? ''] ?? '#999';
  return <FileOutlined style={{ color, fontSize: 12 }} />;
};

// ---- Language detection ----
const getLanguage = (filename: string): string => {
  if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
  if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
  if (filename.endsWith('.json')) return 'json';
  if (filename.endsWith('.md')) return 'markdown';
  if (filename.endsWith('.css')) return 'css';
  if (filename.endsWith('.html')) return 'html';
  if (filename.endsWith('.py')) return 'python';
  if (filename.endsWith('.java')) return 'java';
  if (filename.endsWith('.sh')) return 'shell';
  if (filename.endsWith('.yaml') || filename.endsWith('.yml')) return 'yaml';
  return 'plaintext';
};

// ---- Theme options ----
const THEME_OPTIONS = [
  { key: 'vs-dark', label: 'Dark (VS Dark)' },
  { key: 'vs', label: 'Light (VS Light)' },
  { key: 'hc-black', label: 'High Contrast' },
];

export const EditorPanel: React.FC = React.memo(() => {
  const activeFile = useWorkspaceStore((state) => state.activeFile);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const fileContents = useWorkspaceStore((state) => state.fileContents);
  const setActiveFile = useWorkspaceStore((state) => state.setActiveFile);
  const closeFile = useWorkspaceStore((state) => state.closeFile);
  const updateFileContent = useWorkspaceStore((state) => state.updateFileContent);
  const markFileSaved = useWorkspaceStore((state) => state.markFileSaved);
  const unsavedChanges = useWorkspaceStore((state) => state.unsavedChanges);
  const editorTheme = useWorkspaceStore((state) => state.editorTheme);
  const setEditorTheme = useWorkspaceStore((state) => state.setEditorTheme);
  const setLeftPanelTab = useWorkspaceStore((state) => state.setLeftPanelTab);
  const cursorPositions = useWorkspaceStore((state) => state.cursorPositions);
  const setCursorPosition = useWorkspaceStore((state) => state.setCursorPosition);
  const reorderOpenFiles = useWorkspaceStore((state) => state.reorderOpenFiles);

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof monaco | null>(null);
  const cursorDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Drag state for tab reorder
  const dragIndexRef = useRef<number | null>(null);

  // ---- Check if active file is readonly ----
  const isActiveFileReadonly = React.useMemo(() => {
    if (!activeFile) return false;
    const ws = workspaceService.currentWorkspace;
    const file = ws?.workspace.files.find((f) => f.path === activeFile);
    return file?.readonly === true || file?.locked === true;
  }, [activeFile]);

  // ---- Cursor restore when activeFile changes ----
  useEffect(() => {
    if (editorRef.current && activeFile) {
      const savedPos = cursorPositions[activeFile];
      if (savedPos) {
        // Small delay to let Monaco finish loading the new model
        setTimeout(() => {
          editorRef.current?.setPosition(savedPos);
          editorRef.current?.revealPositionInCenter(savedPos);
        }, 50);
      }
    }
  }, [activeFile, cursorPositions]);

  // ---- Keyboard shortcuts (Ctrl+W, Ctrl+Tab) ----
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const shortcut = resolveWorkspaceKeyboardShortcut(e, editorTheme);
      if (shortcut?.type === 'switch-left-panel') {
        e.preventDefault();
        setLeftPanelTab(shortcut.tab);
        return;
      }

      if (shortcut?.type === 'cycle-editor-theme') {
        e.preventDefault();
        setEditorTheme(shortcut.nextTheme);
        return;
      }

      // Ctrl+W: Close current tab
      if ((e.ctrlKey || e.metaKey) && e.key === 'w') {
        e.preventDefault();
        if (activeFile) {
          closeFile(activeFile);
        }
      }
      // Ctrl+Tab / Ctrl+Shift+Tab: Switch tabs
      if ((e.ctrlKey || e.metaKey) && e.key === 'Tab') {
        e.preventDefault();
        const currentIndex = openFiles.indexOf(activeFile ?? '');
        if (e.shiftKey) {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : openFiles.length - 1;
          setActiveFile(openFiles[prevIndex] ?? null);
        } else {
          const nextIndex = currentIndex < openFiles.length - 1 ? currentIndex + 1 : 0;
          setActiveFile(openFiles[nextIndex] ?? null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => { window.removeEventListener('keydown', handleKeyDown); };
  }, [activeFile, openFiles, closeFile, setActiveFile, setLeftPanelTab, setEditorTheme, editorTheme]);

  const handleEditorMount: OnMount = (editor) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Ctrl/Cmd+S binding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      const currentFile = useWorkspaceStore.getState().activeFile;
      if (currentFile) {
        const content = editor.getValue();
        try {
          workspaceService.writeFile(currentFile, content);
          markFileSaved(currentFile);
        } catch (err) {
          console.error(err);
        }
      }
    });

    // Shift+Alt+F: Format document
    editor.addCommand(
      monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
      () => {
        void editor.getAction('editor.action.formatDocument')?.run();
      },
    );

    // Setup TypeScript Linter & Compiler Options
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    const ts = (monaco.languages as any).typescript;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    ts.typescriptDefaults.setCompilerOptions({
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      target: ts.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      module: ts.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      jsx: ts.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
      typeRoots: ['node_modules/@types'],
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    ts.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });

    // Track cursor position changes with debounce
    editor.onDidChangeCursorPosition(() => {
      if (cursorDebounceRef.current) clearTimeout(cursorDebounceRef.current);
      cursorDebounceRef.current = setTimeout(() => {
        const pos = editor.getPosition();
        const currentFile = useWorkspaceStore.getState().activeFile;
        if (pos && currentFile) {
          setCursorPosition(currentFile, { lineNumber: pos.lineNumber, column: pos.column });
        }
      }, 300);
    });

    // Restore cursor for initial file
    const currentFile = useWorkspaceStore.getState().activeFile;
    if (currentFile) {
      const savedPos = useWorkspaceStore.getState().cursorPositions[currentFile];
      if (savedPos) {
        editor.setPosition(savedPos);
        editor.revealPositionInCenter(savedPos);
      }
    }
  };

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (activeFile && value !== undefined) {
        updateFileContent(activeFile, value);
      }
    },
    [activeFile, updateFileContent],
  );

  // ---- Tab drag handlers ----
  const onDragStart = (index: number) => {
    dragIndexRef.current = index;
  };

  const onDragOver = (e: React.DragEvent, _index: number) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromIndex = dragIndexRef.current;
    if (fromIndex !== null && fromIndex !== toIndex) {
      reorderOpenFiles(fromIndex, toIndex);
    }
    dragIndexRef.current = null;
  };

  // ---- Empty state ----
  if (openFiles.length === 0) {
    return (
      <div className="h-full bg-gray-100 flex items-center justify-center text-gray-400 flex-col gap-2">
        <CodeOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
        <p>No file is open.</p>
        <p className="text-xs text-gray-300">Open a file from the Explorer to start editing.</p>
      </div>
    );
  }

  // ---- Breadcrumb ----
  const breadcrumbItems = activeFile
    ? activeFile.split('/').map((segment, i, arr) => ({
        title: i === arr.length - 1 ? <span className="font-medium">{segment}</span> : segment,
        key: arr.slice(0, i + 1).join('/'),
      }))
    : [];

  const isDark = editorTheme === 'vs-dark' || editorTheme === 'hc-black';

  return (
    <div className="h-full flex flex-col" style={{ background: isDark ? '#1e1e1e' : '#fff' }}>
      {/* Tabs row */}
      <div
        className="flex items-center overflow-x-auto border-b"
        style={{
          background: isDark ? '#252526' : '#f3f3f3',
          borderColor: isDark ? '#3c3c3c' : '#e0e0e0',
          minHeight: 36,
        }}
      >
        {openFiles.map((file, index) => {
          const filename = file.split('/').pop() ?? file;
          const isActive = file === activeFile;
          const isUnsaved = unsavedChanges[file];

          return (
            <div
              key={file}
              draggable
              onDragStart={() => { onDragStart(index); }}
              onDragOver={(e) => { onDragOver(e, index); }}
              onDrop={(e) => { onDrop(e, index); }}
              onClick={() => { setActiveFile(file); }}
              className="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none border-r"
              style={{
                background: isActive
                  ? isDark ? '#1e1e1e' : '#fff'
                  : isDark ? '#2d2d2d' : '#ececec',
                borderColor: isDark ? '#3c3c3c' : '#e0e0e0',
                color: isActive
                  ? isDark ? '#fff' : '#333'
                  : isDark ? '#969696' : '#666',
                borderTop: isActive ? '2px solid #007acc' : '2px solid transparent',
                fontSize: 13,
                whiteSpace: 'nowrap',
              }}
            >
              {getFileIcon(filename)}
              <span>{filename}</span>
              <span className="sr-only">{isActive ? 'Active tab' : 'Inactive tab'}</span>
              {isUnsaved && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#c4c4c4',
                    display: 'inline-block',
                    marginLeft: 2,
                  }}
                />
              )}
              <CloseOutlined
                onClick={(e) => {
                  e.stopPropagation();
                  closeFile(file);
                }}
                style={{ fontSize: 10, color: isDark ? '#969696' : '#999', marginLeft: 4 }}
                className="hover:text-white"
              />
            </div>
          );
        })}
        {/* Spacer */}
        <div className="flex-1" />
        {/* Theme toggle */}
        <Dropdown
          menu={{
            items: THEME_OPTIONS.map((t) => ({
              key: t.key,
              label: t.label,
            })),
            onClick: ({ key }) => { setEditorTheme(key); },
            selectedKeys: [editorTheme],
          }}
          trigger={['click']}
        >
          <Tooltip title="Switch Theme">
            <button
              className="px-2 py-1 mr-1 rounded hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
              aria-label="Switch editor theme"
            >
              <BgColorsOutlined style={{ color: isDark ? '#ccc' : '#666', fontSize: 14 }} />
            </button>
          </Tooltip>
        </Dropdown>
      </div>

      {/* Breadcrumb row */}
      <div
        className="px-3 py-1 text-xs border-b"
        style={{
          background: isDark ? '#252526' : '#f8f8f8',
          borderColor: isDark ? '#3c3c3c' : '#e0e0e0',
        }}
      >
        <Breadcrumb
          items={breadcrumbItems}
          style={{ fontSize: 12, color: isDark ? '#999' : '#666' }}
        />
      </div>

      {/* Monaco editor */}
      <div className="flex-1 min-h-0">
        {activeFile && (
          <Editor
            height="100%"
            language={getLanguage(activeFile)}
            value={fileContents[activeFile]}
            theme={editorTheme}
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
              readOnly: isActiveFileReadonly,
              formatOnPaste: true,
              formatOnType: true,
              tabSize: 2,
              renderWhitespace: 'selection',
              smoothScrolling: true,
              cursorSmoothCaretAnimation: 'on',
              cursorBlinking: 'smooth',
            }}
          />
        )}
      </div>
    </div>
  );
});
