import React, { useEffect, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  message,
  Popconfirm,
  Breadcrumb,
} from 'antd';
import { PlusOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { getTasks, createTask, updateTask, deleteTask } from '../../services/api';
import { useParams, useNavigate, useLocation } from 'react-router-dom';

const { TextArea } = Input;

const Tasks: React.FC = () => {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  // Extract course title from location state if passed, otherwise just show ID
  const courseTitle = location.state?.courseTitle || '课程';

  const fetchTasks = async () => {
    if (!courseId) return;
    try {
      setLoading(true);
      const res = await getTasks({ courseId });
      setData(res as any);
    } catch (e) {
      // Handled globally
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [courseId]);

  const showModal = (record?: any) => {
    if (record) {
      setEditingId(record.id);
      // Pretty print JSON for editing
      const formattedRecord = {
        ...record,
        envConfig: JSON.stringify(record.envConfig, null, 2),
        sandboxConfig: JSON.stringify(record.sandboxConfig, null, 2),
        testConfig: JSON.stringify(record.testConfig, null, 2),
        promptConfig: JSON.stringify(record.promptConfig, null, 2),
      };
      form.setFieldsValue(formattedRecord);
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({
        stage: data.length + 1,
        envConfig: '{\n  \n}',
        sandboxConfig: '{\n  \n}',
        testConfig: '{\n  \n}',
        promptConfig: '{\n  \n}',
      });
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const validateJson = (_: any, value: string) => {
    try {
      if (value && value.trim() !== '') {
        JSON.parse(value);
      }
      return Promise.resolve();
    } catch (e) {
      return Promise.reject('非法的 JSON 格式');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Parse JSON strings back to objects before sending to API
      const payload = {
        ...values,
        courseId,
        envConfig: JSON.parse(values.envConfig || '{}'),
        sandboxConfig: JSON.parse(values.sandboxConfig || '{}'),
        testConfig: JSON.parse(values.testConfig || '{}'),
        promptConfig: JSON.parse(values.promptConfig || '{}'),
      };

      if (editingId) {
        await updateTask(editingId, payload);
        message.success('更新成功');
      } else {
        await createTask(payload);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      fetchTasks();
    } catch (e) {
      // Validation failed or API error
      if (e instanceof Error) {
        message.error(e.message);
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTask(id);
      message.success('删除成功');
      fetchTasks();
    } catch (e) {
      // Error handled by interceptor
    }
  };

  const columns = [
    {
      title: '阶段',
      dataIndex: 'stage',
      key: 'stage',
      width: '10%',
      sorter: (a: any, b: any) => a.stage - b.stage,
    },
    {
      title: '任务名称',
      dataIndex: 'title',
      key: 'title',
      width: '40%',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <div className="flex gap-2">
          <Button
            type="link"
            onClick={() => {
              showModal(record);
            }}
          >
            编辑配置
          </Button>
          <Popconfirm title="确定要删除该任务吗?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger>
              删除
            </Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb className="mb-4">
        <Breadcrumb.Item>
          <a
            onClick={() => {
              navigate('/courses');
            }}
          >
            课程管理
          </a>
        </Breadcrumb.Item>
        <Breadcrumb.Item>{courseTitle}</Breadcrumb.Item>
        <Breadcrumb.Item>任务管理</Breadcrumb.Item>
      </Breadcrumb>

      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              navigate('/courses');
            }}
          >
            返回
          </Button>
          <h1 className="text-2xl font-bold mb-0">任务管理</h1>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            showModal();
          }}
        >
          新增任务
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 20 }}
      />

      <Modal
        title={editingId ? '编辑任务' : '新增任务'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
        width={800}
        maskClosable={false}
      >
        <Form form={form} layout="vertical">
          <div className="flex gap-4">
            <Form.Item
              name="stage"
              label="阶段序号"
              className="w-1/4"
              rules={[{ required: true, message: '请输入阶段序号' }]}
            >
              <InputNumber min={1} className="w-full" />
            </Form.Item>

            <Form.Item
              name="title"
              label="任务名称"
              className="flex-1"
              rules={[{ required: true, message: '请输入任务名称' }]}
            >
              <Input placeholder="输入任务标题" />
            </Form.Item>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="envConfig"
              label="环境配置 (JSON)"
              rules={[{ validator: validateJson }]}
            >
              <TextArea rows={6} className="font-mono text-sm" />
            </Form.Item>

            <Form.Item
              name="sandboxConfig"
              label="沙盒配置 (JSON)"
              rules={[{ validator: validateJson }]}
            >
              <TextArea rows={6} className="font-mono text-sm" />
            </Form.Item>

            <Form.Item
              name="testConfig"
              label="自动化测试配置 (JSON)"
              rules={[{ validator: validateJson }]}
            >
              <TextArea rows={6} className="font-mono text-sm" />
            </Form.Item>

            <Form.Item
              name="promptConfig"
              label="AI Prompt 设定 (JSON)"
              rules={[{ validator: validateJson }]}
            >
              <TextArea rows={6} className="font-mono text-sm" />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default Tasks;
