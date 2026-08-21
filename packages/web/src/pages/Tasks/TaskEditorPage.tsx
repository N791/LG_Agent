import React, { useEffect, useState } from 'react';
import { SCHEMA_IDS } from '@lg-agent/contracts';
import { IChangeEvent } from '@rjsf/core';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Button, message, Layout, Typography, Spin, Space } from 'antd';
import { MarkdownEditor } from '../../components/common/MarkdownEditor';
import { JsonSchemaEditor } from '../../components/common/JsonSchemaEditor';
import { PromptEditor } from '../../components/TaskEditor/PromptEditor';
import { tasksService } from '../../services/tasks';
import { Task } from '../../types';
import { useTranslation } from 'react-i18next';

const { Content, Header } = Layout;
const { Title } = Typography;

export const TaskEditorPage: React.FC = () => {
  const { courseId, taskId } = useParams<{ courseId: string; taskId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation('admin');
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Data
  const [description, setDescription] = useState('');
  const [envConfig, setEnvConfig] = useState<Record<string, unknown>>({});
  const [sandboxConfig, setSandboxConfig] = useState<Record<string, unknown>>({});
  const [testConfig, setTestConfig] = useState<Record<string, unknown>>({});
  const [promptConfig, setPromptConfig] = useState<Record<string, unknown>>({});

  useEffect(() => {
    const fetchTask = async () => {
      try {
        if (!taskId) return;
        const data = await tasksService.getTask(taskId);
        setTask(data);
        setDescription(data.description ?? '');
        setEnvConfig(data.envConfig);
        setSandboxConfig(data.sandboxConfig);
        setTestConfig(data.testConfig);
        setPromptConfig(data.promptConfig);
      } catch (_error) {
        void message.error(t('taskEditor.loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    void fetchTask();
  }, [taskId]);

  const handleSave = async () => {
    if (!taskId) return;
    setSaving(true);
    try {
      await tasksService.updateTask(taskId, {
        description,
        envConfig,
        sandboxConfig,
        testConfig,
        promptConfig,
      });
      void message.success(t('taskEditor.saveSuccess'));
    } catch (_error) {
      void message.error(t('taskEditor.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!task) {
    return <div>{t('taskEditor.notFound')}</div>;
  }

  const items = [
    {
      key: '1',
      label: t('taskEditor.basicInfo'),
      children: (
        <div style={{ padding: '24px 0' }}>
          <Title level={5}>{t('taskEditor.description')}</Title>
          <MarkdownEditor
            value={description}
            onChange={(val) => {
              setDescription(val ?? '');
            }}
          />
        </div>
      ),
    },
    {
      key: '2',
      label: t('taskEditor.environmentSandbox'),
      children: (
        <div style={{ padding: '24px 0' }}>
          <Title level={5}>{t('taskEditor.environmentConfig')}</Title>
          <JsonSchemaEditor
            schemaName={SCHEMA_IDS.env}
            formData={envConfig}
            onChange={(e: IChangeEvent<Record<string, unknown>>) => {
              if (e.formData) setEnvConfig(e.formData);
            }}
            onSubmit={() => {
              void message.success(t('taskEditor.environmentValid'));
            }}
          />
          <div style={{ marginTop: 24 }} />
          <Title level={5}>{t('taskEditor.sandboxConfig')}</Title>
          <JsonSchemaEditor
            schemaName={SCHEMA_IDS.sandbox}
            formData={sandboxConfig}
            onChange={(e: IChangeEvent<Record<string, unknown>>) => {
              if (e.formData) setSandboxConfig(e.formData);
            }}
            onSubmit={() => {
              void message.success(t('taskEditor.sandboxValid'));
            }}
          />
        </div>
      ),
    },
    {
      key: '3',
      label: t('taskEditor.testing'),
      children: (
        <div style={{ padding: '24px 0' }}>
          <Title level={5}>{t('taskEditor.testConfig')}</Title>
          <JsonSchemaEditor
            schemaName={SCHEMA_IDS.test}
            formData={testConfig}
            onChange={(e: IChangeEvent<Record<string, unknown>>) => {
              if (e.formData) setTestConfig(e.formData);
            }}
            onSubmit={() => {
              void message.success(t('taskEditor.testValid'));
            }}
          />
        </div>
      ),
    },
    {
      key: '4',
      label: t('taskEditor.aiPrompt'),
      children: (
        <div style={{ padding: '24px 0' }}>
          <PromptEditor value={promptConfig} onChange={setPromptConfig} />
        </div>
      ),
    },
  ];

  return (
    <Layout style={{ background: '#fff', minHeight: '100%' }}>
      <Header
        style={{
          background: '#fff',
          padding: 0,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          {t('taskEditor.editTitle', { title: task.title })}
        </Title>
        <Space>
          <Button
            onClick={() => {
              navigate(`/courses/${courseId ?? ''}/tasks`);
            }}
          >
            {t('taskEditor.cancel')}
          </Button>
          <Button type="primary" loading={saving} onClick={() => void handleSave()}>
            {t('taskEditor.saveChanges')}
          </Button>
        </Space>
      </Header>
      <Content style={{ marginTop: 16 }}>
        <Tabs items={items} />
      </Content>
    </Layout>
  );
};
