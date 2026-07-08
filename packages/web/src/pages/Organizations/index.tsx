import React, { useEffect, useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { getOrganizations, createOrganization, updateOrganization, deleteOrganization } from '../../services/api';

const Organizations: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const res = await getOrganizations();
      setData(res as any);
    } catch (e) {
      // Error handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const showModal = (record?: any) => {
    if (record) {
      setEditingId(record.id);
      form.setFieldsValue(record);
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
      const values = await form.validateFields();
      if (editingId) {
        await updateOrganization(editingId, values);
        message.success('更新成功');
      } else {
        await createOrganization(values);
        message.success('创建成功');
      }
      setIsModalVisible(false);
      fetchOrganizations();
    } catch (e) {
      // Validate failed or API error
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteOrganization(id);
      message.success('删除成功');
      fetchOrganizations();
    } catch (e) {
      // Error handled by interceptor
    }
  };

  const columns = [
    {
      title: '企业名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '企业编码',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: number) => (
        <Tag color={status === 1 ? 'success' : 'default'}>
          {status === 1 ? '正常' : '禁用'}
        </Tag>
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
      render: (_: any, record: any) => (
        <div className="flex gap-2">
          <Button type="link" icon={<EditOutlined />} onClick={() => { showModal(record); }}>
            编辑
          </Button>
          <Popconfirm title="确定要删除吗?" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" danger icon={<DeleteOutlined />}>
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
        <h1 className="text-2xl font-bold">组织管理</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { showModal(); }}>
          新增组织
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
        title={editingId ? '编辑组织' : '新增组织'}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={handleCancel}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="企业名称"
            rules={[{ required: true, message: '请输入企业名称' }]}
          >
            <Input placeholder="输入企业名称" />
          </Form.Item>
          <Form.Item
            name="code"
            label="企业编码"
            rules={[{ required: true, message: '请输入企业唯一编码' }]}
          >
            <Input placeholder="输入企业编码，如 ALIBABA" disabled={!!editingId} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default Organizations;
