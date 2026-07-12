import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Tabs, Button, message, Layout, Typography, Spin, Space } from 'antd';
import { MarkdownEditor } from '../../components/common/MarkdownEditor';
import { JsonSchemaEditor } from '../../components/common/JsonSchemaEditor';
import { PromptEditor } from '../../components/TaskEditor/PromptEditor';
import { tasksService } from '../../services/tasks';
import { Task } from '../../types';

const { Content, Header } = Layout;
const { Title } = Typography;

export const TaskEditorPage: React.FC = () => {
  const { courseId, taskId } = useParams<{ courseId: string; taskId: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form Data
  const [description, setDescription] = useState('');
  const [envConfig, setEnvConfig] = useState<any>({});
  const [sandboxConfig, setSandboxConfig] = useState<any>({});
  const [testConfig, setTestConfig] = useState<any>({});
  const [promptConfig, setPromptConfig] = useState<any>({});

  useEffect(() => {
    const fetchTask = async () => {
      try {
        if (!taskId) return;
        const data = await tasksService.getTask(taskId);
        setTask(data);
        setDescription(data.description || '');
        setEnvConfig(data.envConfig || {});
        setSandboxConfig(data.sandboxConfig || {});
        setTestConfig(data.testConfig || {});
        setPromptConfig(data.promptConfig || {});
      } catch (error) {
        message.error('Failed to load task details');
      } finally {
        setLoading(false);
      }
    };
    fetchTask();
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
      message.success('Task saved successfully');
    } catch (error) {
      message.error('Failed to save task');
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
    return <div>Task not found</div>;
  }

  const items = [
    {
      key: '1',
      label: 'Basic Info',
      children: (
        <div style={{ padding: '24px 0' }}>
          <Title level={5}>Task Description</Title>
          <MarkdownEditor
            value={description}
            onChange={(val) => setDescription(val || '')}
          />
        </div>
      ),
    },
    {
      key: '2',
      label: 'Environment & Sandbox',
      children: (
        <div style={{ padding: '24px 0' }}>
          <Title level={5}>Environment Config</Title>
          <JsonSchemaEditor
            schemaName="lg-agent:schema:env"
            formData={envConfig}
            onChange={(e: any) => setEnvConfig(e.formData)}
            onSubmit={() => message.success('Env config valid')}
          />
          <div style={{ marginTop: 24 }} />
          <Title level={5}>Sandbox Config</Title>
          <JsonSchemaEditor
            schemaName="lg-agent:schema:sandbox"
            formData={sandboxConfig}
            onChange={(e: any) => setSandboxConfig(e.formData)}
            onSubmit={() => message.success('Sandbox config valid')}
          />
        </div>
      ),
    },
    {
      key: '3',
      label: 'Testing',
      children: (
        <div style={{ padding: '24px 0' }}>
          <Title level={5}>Test Config</Title>
          <JsonSchemaEditor
            schemaName="lg-agent:schema:test"
            formData={testConfig}
            onChange={(e: any) => setTestConfig(e.formData)}
            onSubmit={() => message.success('Test config valid')}
          />
        </div>
      ),
    },
    {
      key: '4',
      label: 'AI Prompt',
      children: (
        <div style={{ padding: '24px 0' }}>
          <PromptEditor
            value={promptConfig}
            onChange={setPromptConfig}
          />
        </div>
      ),
    },
  ];

  return (
    <Layout style={{ background: '#fff', minHeight: '100%' }}>
      <Header style={{ background: '#fff', padding: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>Edit Task: {task.title}</Title>
        <Space>
          <Button onClick={() => navigate(`/courses/${courseId}/tasks`)}>Cancel</Button>
          <Button type="primary" loading={saving} onClick={handleSave}>
            Save Changes
          </Button>
        </Space>
      </Header>
      <Content style={{ marginTop: 16 }}>
        <Tabs items={items} />
      </Content>
    </Layout>
  );
};
