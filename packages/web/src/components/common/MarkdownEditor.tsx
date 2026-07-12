import React from 'react';
import MDEditor, { MDEditorProps } from '@uiw/react-md-editor';

export interface MarkdownEditorProps extends MDEditorProps {
  // Custom extensions or overrides can go here
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = (props) => {
  return (
    <div data-color-mode="light">
      <MDEditor
        {...props}
        height={props.height || 400}
      />
    </div>
  );
};
