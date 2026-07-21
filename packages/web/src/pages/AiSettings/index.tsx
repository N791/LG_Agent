/* eslint-disable */
import { useEffect, useState } from 'react';
import { Form, Input, Button, Tabs, Card, message, Switch, Select, InputNumber } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import request from '../../utils/request';
import { useTranslation } from 'react-i18next';

export default function AiSettings() {
  const { t } = useTranslation('ai');
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

        RAG_ENABLED: (res as any).RAG_ENABLED !== 'false',
        RAG_TOP_K: (res as any).RAG_TOP_K ? Number((res as any).RAG_TOP_K) : 3,
        RAG_CHUNK_SIZE: (res as any).RAG_CHUNK_SIZE ? Number((res as any).RAG_CHUNK_SIZE) : 1000,
      });
    } catch (err) {
      message.error(t('messages.loadFailed'));
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
        RAG_ENABLED: values.RAG_ENABLED ? 'true' : 'false',
        RAG_TOP_K: values.RAG_TOP_K?.toString(),
        RAG_CHUNK_SIZE: values.RAG_CHUNK_SIZE?.toString(),
      };

      // Do not send empty string for API keys if they were not modified
      if (!payload.OPENAI_API_KEY) delete payload.OPENAI_API_KEY;
      if (!payload.DEEPSEEK_API_KEY) delete payload.DEEPSEEK_API_KEY;

      await request.post('/system/configs/ai', payload);
      message.success(t('messages.updateSuccess'));
      fetchConfigs();
    } catch (err) {
      message.error(t('messages.updateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const items = [
    {
      key: 'general',
      label: t('tabs.general'),
      children: (
        <>
          <Form.Item
            label={t('general.defaultProvider')}
            name="DEFAULT_AI_PROVIDER"
            help={t('general.defaultProviderHelp')}
          >
            <Select>
              <Select.Option value="openai">{t('general.providers.openai')}</Select.Option>
              <Select.Option value="deepseek">{t('general.providers.deepseek')}</Select.Option>
              <Select.Option value="mock">{t('general.providers.mock')}</Select.Option>
            </Select>
          </Form.Item>
        </>
      ),
    },
    {
      key: 'openai',
      label: t('tabs.openai'),
      children: (
        <>
          <Form.Item
            label={t('fields.apiKey')}
            name="OPENAI_API_KEY"
            help={
              data.OPENAI_API_KEY_EXISTS ? t('hints.keyConfigured') : t('hints.requiredForOpenAI')
            }
          >
            <Input.Password
              placeholder={
                data.OPENAI_API_KEY_EXISTS ? t('hints.maskedKey') : t('hints.enterApiKey')
              }
            />
          </Form.Item>
          <Form.Item label={t('fields.baseUrl')} name="OPENAI_BASE_URL">
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>
          <Form.Item label={t('fields.defaultModel')} name="OPENAI_DEFAULT_MODEL">
            <Input placeholder="gpt-4o" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'deepseek',
      label: t('tabs.deepseek'),
      children: (
        <>
          <Form.Item
            label={t('fields.apiKey')}
            name="DEEPSEEK_API_KEY"
            help={
              data.DEEPSEEK_API_KEY_EXISTS
                ? t('hints.keyConfigured')
                : t('hints.requiredForDeepSeek')
            }
          >
            <Input.Password
              placeholder={
                data.DEEPSEEK_API_KEY_EXISTS ? t('hints.maskedKey') : t('hints.enterApiKey')
              }
            />
          </Form.Item>
          <Form.Item label={t('fields.baseUrl')} name="DEEPSEEK_BASE_URL">
            <Input placeholder="https://api.deepseek.com/v1" />
          </Form.Item>
          <Form.Item label={t('fields.defaultModel')} name="DEEPSEEK_DEFAULT_MODEL">
            <Input placeholder="deepseek-chat" />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'mock',
      label: t('tabs.mock'),
      children: (
        <>
          <Form.Item label={t('fields.enableMock')} name="MOCK_LLM_ENABLED" valuePropName="checked">
            <Switch />
          </Form.Item>
        </>
      ),
    },
    {
      key: 'rag',
      label: t('tabs.rag'),
      children: (
        <>
          <Form.Item label={t('fields.enableRag')} name="RAG_ENABLED" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label={t('fields.ragTopK')} name="RAG_TOP_K">
            <InputNumber min={1} max={20} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label={t('fields.ragChunkSize')} name="RAG_CHUNK_SIZE">
            <InputNumber min={100} max={10000} step={100} style={{ width: '100%' }} />
          </Form.Item>
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card title={t('title')} loading={loading}>
        <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 600 }}>
          <Tabs defaultActiveKey="general" items={items} />

          <Form.Item style={{ marginTop: 24 }}>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving}>
              {t('saveButton')}
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
