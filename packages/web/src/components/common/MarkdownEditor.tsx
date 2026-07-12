import React from 'react';
import MDEditor, { MDEditorProps } from '@uiw/react-md-editor';

export type MarkdownEditorProps = MDEditorProps;

export const MarkdownEditor: React.FC<MarkdownEditorProps> = (props) => {
  return (
    <div data-color-mode="light">
      <MDEditor {...props} height={props.height ?? 400} />
    </div>
  );
};
