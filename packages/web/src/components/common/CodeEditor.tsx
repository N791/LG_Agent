import React from 'react';
import Editor, { EditorProps } from '@monaco-editor/react';
import { Spin } from 'antd';
import { useTranslation } from 'react-i18next';

export type CodeEditorProps = EditorProps;

export const CodeEditor: React.FC<CodeEditorProps> = (props) => {
  const { t } = useTranslation('admin');
  return (
    <Editor
      loading={<Spin tip={t('editor.loading')} />}
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
