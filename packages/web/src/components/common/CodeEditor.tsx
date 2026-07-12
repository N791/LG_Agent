import React from 'react';
import Editor, { EditorProps } from '@monaco-editor/react';
import { Spin } from 'antd';

export type CodeEditorProps = EditorProps;

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
