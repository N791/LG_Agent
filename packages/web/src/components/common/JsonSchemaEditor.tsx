import React, { useEffect, useState } from 'react';
import Form from '@rjsf/antd';
import { FormProps, IChangeEvent } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { schemasService } from '../../services/schemas';
import { Spin, Radio, Alert, Card, type RadioChangeEvent } from 'antd';
import Editor from '@monaco-editor/react';
import type { SchemaId, SchemaName } from '@lg-agent/contracts';
import { useTranslation } from 'react-i18next';

export interface JsonSchemaEditorProps extends Omit<FormProps, 'schema' | 'validator'> {
  schemaName: SchemaName | SchemaId;
}

type Mode = 'FORM' | 'JSON';

export const JsonSchemaEditor: React.FC<JsonSchemaEditorProps> = ({
  schemaName,
  formData,
  onChange,
  ...props
}) => {
  const { t } = useTranslation('admin');
  const [schema, setSchema] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<Mode>('FORM');
  const [jsonText, setJsonText] = useState<string>('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const data = await schemasService.getSchema(schemaName);
        setSchema(data);
      } catch (error) {
        console.error(`Failed to load schema: ${schemaName}`, error);
      } finally {
        setLoading(false);
      }
    };
    void fetchSchema();
  }, [schemaName]);

  // Sync incoming formData to jsonText if we are not actively typing in JSON
  // To avoid cursor jumping, we only sync if the stringified formData differs from parsed jsonText
  useEffect(() => {
    try {
      const currentParsed = JSON.parse(jsonText || '{}') as unknown;
      if (JSON.stringify(currentParsed) !== JSON.stringify(formData ?? {})) {
        setJsonText(JSON.stringify(formData ?? {}, null, 2));
      }
      setJsonError(null);
    } catch (_e) {
      // If there's an error in jsonText, it means user is typing invalid JSON, don't overwrite it
    }
  }, [formData]);

  const handleJsonChange = (val: string | undefined) => {
    const newText = val ?? '{}';
    setJsonText(newText);
    try {
      const parsed = JSON.parse(newText) as unknown;
      setJsonError(null);
      if (onChange) {
        // Mock IChangeEvent structure required by rjsf
        onChange({ formData: parsed } as unknown as IChangeEvent);
      }
    } catch (e: unknown) {
      setJsonError(t('editor.jsonSyntaxError', { message: (e as Error).message }));
    }
  };

  const handleModeChange = (e: RadioChangeEvent) => {
    const newMode = e.target.value as Mode;
    if (newMode === 'FORM' && jsonError) {
      // Don't switch if JSON is invalid
      return;
    }
    setMode(newMode);
  };

  if (loading) {
    return <Spin tip={t('editor.loadingSchema', { name: schemaName })} />;
  }

  if (!schema) {
    return <div>{t('editor.schemaLoadFailed', { name: schemaName })}</div>;
  }

  return (
    <Card
      size="small"
      extra={
        <Radio.Group value={mode} onChange={handleModeChange} size="small" buttonStyle="solid">
          <Radio.Button value="FORM">{t('editor.visualForm')}</Radio.Button>
          <Radio.Button value="JSON">{t('editor.rawJson')}</Radio.Button>
        </Radio.Group>
      }
      className="mb-4 shadow-sm border border-gray-200"
    >
      {mode === 'JSON' ? (
        <div className="border rounded h-[400px]">
          {jsonError && (
            <Alert
              message={t('editor.invalidJson')}
              description={jsonError}
              type="error"
              showIcon
              banner
            />
          )}
          <Editor
            height={jsonError ? '360px' : '400px'}
            defaultLanguage="json"
            value={jsonText}
            onChange={handleJsonChange}
            options={{
              minimap: { enabled: false },
              formatOnPaste: true,
              scrollBeyondLastLine: false,
              tabSize: 2,
            }}
          />
        </div>
      ) : (
        <div style={{ maxHeight: '500px', overflowY: 'auto', paddingRight: '12px' }}>
          <Form
            {...props}
            schema={schema}
            formData={formData as Record<string, unknown>}
            validator={validator}
            onChange={onChange}
            liveValidate
            showErrorList={false}
          >
            <div /> {/* Hide the default submit button */}
          </Form>
        </div>
      )}
    </Card>
  );
};
