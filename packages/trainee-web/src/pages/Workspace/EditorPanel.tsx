import React, { useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { workspaceService } from '../../services/workspace/WorkspaceService';
import { Tabs } from 'antd';

export const EditorPanel: React.FC = () => {
  const activeFile = useWorkspaceStore((state) => state.activeFile);
  const openFiles = useWorkspaceStore((state) => state.openFiles);
  const fileContents = useWorkspaceStore((state) => state.fileContents);
  const setActiveFile = useWorkspaceStore((state) => state.setActiveFile);
  const closeFile = useWorkspaceStore((state) => state.closeFile);
  const updateFileContent = useWorkspaceStore((state) => state.updateFileContent);
  const markFileSaved = useWorkspaceStore((state) => state.markFileSaved);
  const unsavedChanges = useWorkspaceStore((state) => state.unsavedChanges);
  const editorRef = useRef<unknown>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleEditorMount: OnMount = (editor, monaco: any) => {
    editorRef.current = editor;

    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
    // Ctrl/Cmd+S binding
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeFile) {
        const content = editor.getValue();
        try {
          workspaceService.writeFile(activeFile, content);
          markFileSaved(activeFile);
        } catch (err) {
          console.error(err);
        }
      }
    });

    // Setup TypeScript Linter & Compiler Options
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ES2020,
      allowNonTsExtensions: true,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
      noEmit: true,
      esModuleInterop: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      reactNamespace: 'React',
      allowJs: true,
      typeRoots: ['node_modules/@types'],
    });

    monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
    });
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
  };

  const handleEditorChange = (value: string | undefined) => {
    if (activeFile && value !== undefined) {
      updateFileContent(activeFile, value);
    }
  };

  const onTabChange = (key: string) => {
    setActiveFile(key);
  };

  const onTabEdit = (
    targetKey: React.MouseEvent | React.KeyboardEvent | string,
    action: 'add' | 'remove',
  ) => {
    if (action === 'remove' && typeof targetKey === 'string') {
      closeFile(targetKey);
    }
  };

  if (openFiles.length === 0) {
    return (
      <div className="h-full bg-gray-100 flex items-center justify-center text-gray-400">
        <p>No file is open.</p>
      </div>
    );
  }

  const items = openFiles.map((file) => {
    const filename = file.split('/').pop() ?? file;
    const isUnsaved = unsavedChanges[file];
    return {
      key: file,
      label: isUnsaved ? `${filename} *` : filename,
    };
  });

  const getLanguage = (filename: string) => {
    if (filename.endsWith('.ts') || filename.endsWith('.tsx')) return 'typescript';
    if (filename.endsWith('.js') || filename.endsWith('.jsx')) return 'javascript';
    if (filename.endsWith('.json')) return 'json';
    if (filename.endsWith('.md')) return 'markdown';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.html')) return 'html';
    return 'plaintext';
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <Tabs
        hideAdd
        type="editable-card"
        activeKey={activeFile ?? ''}
        onChange={onTabChange}
        onEdit={onTabEdit}
        items={items}
        className="h-10"
      />
      <div className="flex-1 min-h-0">
        {activeFile && (
          <Editor
            height="100%"
            language={getLanguage(activeFile)}
            value={fileContents[activeFile]}
            theme="vs-dark"
            onChange={handleEditorChange}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              wordWrap: 'on',
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
};
