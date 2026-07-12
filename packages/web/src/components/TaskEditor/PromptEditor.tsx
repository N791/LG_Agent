import React, { useEffect, useState } from 'react';
import { Select, Typography, Space, Card } from 'antd';
import { CodeEditor } from '../common/CodeEditor';
import { aiService } from '../../services/ai';
import { ModelInfoDTO } from '@lg-agent/contracts';

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
  const [models, setModels] = useState<ModelInfoDTO[]>([]);
  const [loading, setLoading] = useState(true);

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

  const handleChange = (field: string, fieldValue: unknown) => {
    onChange?.({
      ...value,
      [field]: fieldValue,
    });
  };

  return (
    <Card title="AI Prompt Configuration">
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        <div>
          <Text strong>AI Model</Text>
          <Select
            style={{ width: '100%', marginTop: 8 }}
            placeholder="Select AI Model"
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
          <Text strong>System Prompt</Text>
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
          <Text strong>User Prompt Template</Text>
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
