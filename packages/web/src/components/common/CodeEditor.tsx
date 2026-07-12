import React from 'react';
import Editor, { EditorProps } from '@monaco-editor/react';
import { Spin } from 'antd';

export interface CodeEditorProps extends EditorProps {
  // Add any common custom code editor properties here
}

export const CodeEditor: React.FC<CodeEditorProps> = (props) => {
  return (
    <Editor
      loading={<Spin tip="Loading Editor..." />}
      theme="vs-light"
      options={{
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        wordWrap: 'on',
        ...props.options,
      }}
      {...props}
    />
  );
};
