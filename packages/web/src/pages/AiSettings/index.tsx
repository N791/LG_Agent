/* eslint-disable */
import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Tabs, Card, message, Switch, Select } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import request from '../../utils/request';

export default function AiSettings() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<any>({});

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const res = await request.get('/system/configs/ai');
      setData(res as any);
      form.setFieldsValue({
        DEFAULT_AI_PROVIDER: (res as any).DEFAULT_AI_PROVIDER || 'openai',
        MOCK_LLM_ENABLED: (res as any).MOCK_LLM_ENABLED === 'true',

        OPENAI_BASE_URL: (res as any).OPENAI_BASE_URL,
        OPENAI_DEFAULT_MODEL: (res as any).OPENAI_DEFAULT_MODEL,

        DEEPSEEK_BASE_URL: (res as any).DEEPSEEK_BASE_URL,
        DEEPSEEK_DEFAULT_MODEL: (res as any).DEEPSEEK_DEFAULT_MODEL,
      });
    } catch (err) {
      message.error('Failed to load AI Configurations');
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      const payload = {
        ...values,
        MOCK_LLM_ENABLED: values.MOCK_LLM_ENABLED ? 'true' : 'false',
      };

      // Do not send empty string for API keys if they were not modified
      if (!payload.OPENAI_API_KEY) delete payload.OPENAI_API_KEY;
      if (!payload.DEEPSEEK_API_KEY) delete payload.DEEPSEEK_API_KEY;

      await request.post('/system/configs/ai', payload);
      message.success('AI Configurations updated successfully');
      fetchConfigs();
    } catch (err) {
      message.error('Failed to update AI Configurations');
    } finally {
      setSaving(false);
    }
  };

  const items = [
    {
      key: 'general',
      label: 'General Settings',
      children: (
        <>
          <Form.Item
            label="Default Provider"
            name="DEFAULT_AI_PROVIDER"
            help="The provider to use if a task doesn't specify one."
          >
            <Select>
              <Select.Option value="openai">OpenAI</Select.Option>
              <Select.Option value="deepseek">DeepSeek</Select.Option>
              <Select.Option value="mock">Mock</Select.Option>
            </Select>
          </Form.Item>
        </>
      ),
    },
    {
      key: 'openai',
      label: 'OpenAI',
      children: (
        <>
          <Form.Item
            label="API Key"
            name="OPENAI_API_KEY"
            help={
              data.OPENAI_API_KEY_EXISTS
                ? 'An API Key is already configured. Leave blank to keep the existing key.'
                : 'Required for OpenAI.'
            }
          >
            <Input.Password
              placeholder={data.OPENAI_API_KEY_EXISTS ? '••••••••••••••••' : 'Enter API Key'}
            />
          </Form.Item>
          <Form.Item label="Base URL" name="OPENAI_BASE_URL">
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item label="Default Model" name="OPENAI_DEFAULT_MODEL">
            <Input placeholder="gpt-4o" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'deepseek',
      label: 'DeepSeek',
      children: (
        <>
          <Form.Item
            label="API Key"
            name="DEEPSEEK_API_KEY"
            help={
              data.DEEPSEEK_API_KEY_EXISTS
                ? 'An API Key is already configured. Leave blank to keep the existing key.'
                : 'Required for DeepSeek.'
            }
          >
            <Input.Password
              placeholder={data.DEEPSEEK_API_KEY_EXISTS ? '••••••••••••••••' : 'Enter API Key'}
            />
          </Form.Item>
          <Form.Item label="Base URL" name="DEEPSEEK_BASE_URL">
            <Input placeholder="https://api.deepseek.com/v1" />
          </Form.Item>
          <Form.Item label="Default Model" name="DEEPSEEK_DEFAULT_MODEL">
            <Input placeholder="deepseek-chat" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'mock',
      label: 'Mock Settings',
      children: (
        <>
          <Form.Item label="Enable Mock Provider" name="MOCK_LLM_ENABLED" valuePropName="checked">
            <Switch />
          </Form.Item>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title="AI API Configurations" loading={loading}>
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 600 }}>
          <Tabs defaultActiveKey="general" items={items} />

          <Form.Item style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              Save Configurations
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
