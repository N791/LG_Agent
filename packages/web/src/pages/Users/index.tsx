import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getUsers, createUser, updateUser, deleteUser, getOrganizations } from '../../services/api';
import { User, Organization } from '../../types';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

const { Option } = Select;

const Users: React.FC = () => {
  const [data, setData] = useState<User[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const user = useSelector((state: RootState) => state.auth.user);
  const isMentor = user?.role === 'MENTOR';

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await getUsers();
      setData(res as unknown as User[]);
    } catch (_e) {
      // Handled globally
    } finally {
      setLoading(false);
    }
  };

  const fetchOrgs = async () => {
    try {
      const res = await getOrganizations();
      setOrganizations(res as unknown as Organization[]);
    } catch (_e) {
      // Handled globally
    }
  };

  useEffect(() => {
    void fetchUsers();
    void fetchOrgs();
  }, []);

  const showModal = (record?: User) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue({
        ...record,
        password: '', // Clear password field for edit, only update if filled
      });
    } else {
      setEditingId(null);
      form.resetFields();
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
      if (!values['password']) {
        delete values['password']; // Do not send empty password if editing
      }

      if (editingId) {
        await updateUser(editingId, values);
        void message.success('更新成功');
      } else {
        await createUser(values);
        void message.success('创建成功');
      }
      setIsModalVisible(false);
      void fetchUsers();
    } catch (_e) {
      // Validate failed or API error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      void message.success('删除成功');
      void fetchUsers();
    } catch (_e) {
      // Error handled by interceptor
    }
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
    },
    {
      title: '所属组织',
      dataIndex: ['organization', 'name'],
      key: 'orgName',
      render: (text: string) => text || '-',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => {
        let color = 'blue';
        if (role === 'ADMIN') color = 'red';
        if (role === 'MENTOR') color = 'purple';
        return <Tag color={color}>{role}</Tag>;
      },
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
      render: (_: unknown, record: User) => {
        if (isMentor) {
          return <span className="text-gray-400">无权限</span>;
        }
        return (
          <div className="flex gap-2">
            <Button
              type="link"
              icon={<EditOutlined />}
              onClick={() => {
                showModal(record);
              }}
            >
              编辑
            </Button>
            <Popconfirm title="确定要删除吗?" onConfirm={() => void handleDelete(record.id)}>
              <Button type="link" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">用户管理</h1>
        {!isMentor && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              showModal();
            }}
          >
            新增用户
          </Button>
        )}
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={editingId ? '编辑用户' : '新增用户'}
        open={isModalVisible}
        onOk={() => void handleSubmit()}
        onCancel={handleCancel}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="输入登录用户名" disabled={!!editingId} />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: !editingId, message: '请输入密码' }]}
            help={editingId ? '留空表示不修改密码' : ''}
          >
            <Input.Password placeholder="输入密码" />
          </Form.Item>

          <Form.Item name="nickname" label="昵称">
            <Input placeholder="输入用户显示昵称" />
          </Form.Item>

          <Form.Item
            name="email"
            label="邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱' }]}
          >
            <Input placeholder="输入邮箱" />
          </Form.Item>

          <Form.Item name="role" label="角色" rules={[{ required: true, message: '请选择角色' }]}>
            <Select placeholder="选择角色">
              <Option value="ADMIN">系统管理员</Option>
              <Option value="MENTOR">导师</Option>
              <Option value="TRAINEE">学员</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="organizationId"
            label="所属企业"
            rules={[{ required: true, message: '请选择所属企业' }]}
          >
            <Select placeholder="选择企业">
              {organizations.map((org) => (
                <Option key={org.id} value={org.id}>
                  {org.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Users;
