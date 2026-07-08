import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import {
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getOrganizations,
} from '../../services/api';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { useNavigate } from 'react-router-dom';
import { Course, Organization } from '../../types';

const { Option } = Select;
const { TextArea } = Input;

const Courses: React.FC = () => {
  const [data, setData] = useState<Course[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const userRole = useSelector((state: RootState) => state.auth.user?.role);
  const userOrgId = useSelector((state: RootState) => state.auth.user?.organizationId); // Assuming we added it to JWT and store, but we can rely on backend fallback if missing.

  const fetchCourses = async () => {
    try {
      setLoading(true);
      const res = await getCourses(userRole === 'ADMIN' ? {} : { organizationId: userOrgId });
      setData(res as Course[]);
    } catch (_e) {
      // Handled globally
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgs = async () => {
    if (userRole !== 'ADMIN') return;
    try {
      const res = await getOrganizations();
      setOrganizations(res as Organization[]);
    } catch (_e) {
      // Handled globally
    }
  };

  useEffect(() => {
    void fetchCourses();
    void fetchOrgs();
  }, [userRole]);

  const showModal = (record?: Course) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue(record);
    } else {
      setEditingId(null);
      form.resetFields();
      form.setFieldsValue({ version: 'v1.0.0' });
    }
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = (await form.validateFields()) as Record<string, unknown>;
      if (editingId) {
        await updateCourse(editingId, values);
        void message.success('更新成功');
      } else {
        await createCourse(values);
        void message.success('创建成功');
      }
      setIsModalVisible(false);
      void fetchCourses();
    } catch (_e) {
      // Validate failed or API error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCourse(id);
      void message.success('删除成功');
      void fetchCourses();
    } catch (_e) {
      // Error handled by interceptor
    }
  };

  const handlePublish = async (record: Course) => {
    try {
      const newStatus = record.status === 0 ? 1 : 0;
      await updateCourse(record.id, { status: newStatus });
      void message.success(newStatus === 1 ? '发布成功' : '已取消发布');
      void fetchCourses();
    } catch (_e) {
      // Error handled
    }
  };

  const columns = [
    {
      title: '课程名称',
      dataIndex: 'title',
      key: 'title',
      width: '20%',
    },
    {
      title: '版本',
      dataIndex: 'version',
      key: 'version',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '创建人',
      dataIndex: ['createdBy', 'nickname'],
      render: (text: string | undefined, record: Course) =>
        text ?? record.createdBy?.username ?? '-',
    },
    {
      title: '所属组织',
      dataIndex: ['organization', 'name'],
      key: 'orgName',
      render: (text: string) => text || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => (
        <Tag color={status === 1 ? 'success' : 'default'}>{status === 1 ? '已发布' : '草稿'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Course) => (
        <div className="flex gap-2">
          <Button
            type="link"
            onClick={() => {
              navigate(`/courses/${record.id}/tasks`, { state: { courseTitle: record.title } });
            }}
          >
            任务管理
          </Button>
          <Button
            type="link"
            onClick={() => {
              showModal(record);
            }}
          >
            编辑
          </Button>
          <Button type="link" onClick={() => void handlePublish(record)}>
            {record.status === 0 ? '发布' : '下架'}
          </Button>
          <Popconfirm title="确定要删除吗?" onConfirm={() => void handleDelete(record.id)}>
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">课程管理</h1>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            showModal();
          }}
        >
          新增课程
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingId ? '编辑课程' : '新增课程'}
        open={isModalVisible}
        onOk={() => void handleSubmit()}
        onCancel={handleCancel}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="title"
            label="课程名称"
            rules={[{ required: true, message: '请输入课程名称' }]}
          >
            <Input placeholder="输入课程标题" />
          </Form.Item>

          <Form.Item name="description" label="课程简介">
            <TextArea rows={4} placeholder="输入课程详细描述" />
          </Form.Item>

          <Form.Item
            name="version"
            label="版本号"
            rules={[{ required: true, message: '请输入版本号' }]}
          >
            <Input placeholder="例如: v1.0.0" />
          </Form.Item>

          {userRole === 'ADMIN' && (
            <Form.Item
              name="organizationId"
              label="所属企业"
              rules={[{ required: !editingId, message: '请选择所属企业' }]}
            >
              <Select placeholder="选择企业 (仅Admin可见)">
                {organizations.map((org) => (
                  <Option key={org.id} value={org.id}>
                    {org.name}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default Courses;
