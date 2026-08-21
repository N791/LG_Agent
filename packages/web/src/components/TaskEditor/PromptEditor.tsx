import React, { useEffect, useMemo, useState } from 'react';
import { Select, Typography, Space, Card, Alert } from 'antd';
import { CodeEditor } from '../common/CodeEditor';
import { aiService } from '../../services/ai';
import { schemasService } from '../../services/schemas';
import { ModelInfoDTO, SCHEMA_IDS } from '@lg-agent/contracts';
import Ajv, { type ErrorObject, type ValidateFunction } from 'ajv';
import { useTranslation } from 'react-i18next';

const { Option } = Select;
const { Text } = Typography;

export interface PromptEditorValue {
  model?: string;
  systemPrompt?: string;
  userPromptTemplate?: string;
  [key: string]: unknown;
}

interface PromptEditorProps {
  value?: PromptEditorValue;
  onChange?: (value: PromptEditorValue) => void;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({ value, onChange }) => {
  const { t } = useTranslation('admin');
  const [models, setModels] = useState<ModelInfoDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaValidator, setSchemaValidator] = useState<ValidateFunction | null>(null);
  const [schemaLoadFailed, setSchemaLoadFailed] = useState(false);

  useEffect(() => {
    const fetchModels = async () => {
      try {
        const data = await aiService.getModels();
        setModels(data);
      } catch (error) {
        console.error('Failed to load models:', error);
      } finally {
        setLoading(false);
      }
    };
    void fetchModels();
  }, []);

  useEffect(() => {
    let active = true;
    const loadPromptSchema = async () => {
      try {
        const schema = await schemasService.getSchema(SCHEMA_IDS.prompt);
        const validator = new Ajv({ allErrors: true, strict: false }).compile(schema);
        if (active) setSchemaValidator(() => validator);
      } catch (_error) {
        if (active) setSchemaLoadFailed(true);
      }
    };
    void loadPromptSchema();
    return () => {
      active = false;
    };
  }, []);

  const schemaErrors = useMemo<ErrorObject[]>(() => {
    if (!schemaValidator) return [];
    return schemaValidator(value ?? {}) ? [] : [...(schemaValidator.errors ?? [])];
  }, [schemaValidator, value]);

  const handleChange = (field: string, fieldValue: unknown) => {
    onChange?.({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <Card title={t('promptEditor.title')}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {schemaLoadFailed && (
          <Alert
            type="error"
            showIcon
            message={t('promptEditor.schemaUnavailable')}
            description={t('promptEditor.schemaUnavailableDetail')}
          />
        )}
        {schemaErrors.length > 0 && (
          <Alert
            type="error"
            showIcon
            message={t('promptEditor.invalid')}
            description={schemaErrors
              .map((error) =>
                t('promptEditor.invalidItem', {
                  path: error.instancePath || '/',
                  message: error.message ?? t('promptEditor.invalidValue'),
                }),
              )
              .join('; ')}
          />
        )}
        <div>
          <Text strong>{t('promptEditor.model')}</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            placeholder={t('promptEditor.selectModel')}
            loading={loading}
            value={value?.model}
            onChange={(val) => {
              handleChange('model', val);
            }}
          >
            {models
              .filter((m) => m.enabled && m.capabilities.includes('chat'))
              .map((model) => (
                <Option key={model.id} value={model.id}>
                  {model.name} ({model.provider})
                </Option>
              ))}
          </Select>
        </div>

        <div>
          <Text strong>{t('promptEditor.systemPrompt')}</Text>
          <div
            style={{
              marginTop: 8,
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <CodeEditor
              height="200px"
              language="markdown"
              value={value?.systemPrompt ?? ''}
              onChange={(val) => {
                handleChange('systemPrompt', val);
              }}
              options={{ minimap: { enabled: false } }}
            />
          </div>
        </div>

        <div>
          <Text strong>{t('promptEditor.userPromptTemplate')}</Text>
          <div
            style={{
              marginTop: 8,
              border: '1px solid #d9d9d9',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <CodeEditor
              height="200px"
              language="markdown"
              value={value?.userPromptTemplate ?? ''}
              onChange={(val) => {
                handleChange('userPromptTemplate', val);
              }}
              options={{ minimap: { enabled: false } }}
            />
          </div>
        </div>
      </Space>
    </Card>
  );
};
