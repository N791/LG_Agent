import React, { useEffect, useState } from 'react';
import { Table, Button, Space, Modal, Typography, message, Tag } from 'antd';
import { submissionsService, Submission } from '../../services/submissions';
import { reportsService } from '../../services/reports';
import { DownloadOutlined, EyeOutlined } from '@ant-design/icons';
import ReactJson from 'react-json-view';

const { Title } = Typography;

const Submissions: React.FC = () => {
  const [data, setData] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [isModalVisible, setIsModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Record<string, unknown> | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await submissionsService.findAll({});
      setData((res as unknown as { data?: Submission[] }).data ?? (res as unknown as Submission[]));
    } catch (_error) {
      void message.error('Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await reportsService.exportReport('submissions', 'csv');
      // Create a blob URL and trigger download
      const url = window.URL.createObjectURL(new Blob([response as unknown as BlobPart]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `submissions_export_${String(new Date().getTime())}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      void message.success('Export downloaded successfully');
    } catch (_error) {
      void message.error('Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const showReport = (record: Submission) => {
    setSelectedReport(
      record.report ?? { message: 'No AI review report available for this submission.' },
    );
    setIsModalVisible(true);
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', ellipsis: true },
    {
      title: 'Trainee',
      key: 'trainee',
      render: (_: unknown, record: Submission) => record.user?.username ?? 'Unknown',
    },
    {
      title: 'Task',
      key: 'task',
      render: (_: unknown, record: Submission) => record.task?.title ?? 'Unknown',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'PASSED') color = 'success';
        if (status === 'FAILED') color = 'error';
        if (status === 'RUNNING') color = 'processing';
        return <Tag color={color}>{status}</Tag>;
      },
    },
    { title: 'Score', dataIndex: 'score', key: 'score' },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: unknown, record: Submission) => (
        <Space size="middle">
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => {
              showReport(record);
            }}
          >
            AI Review
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Title level={3} style={{ margin: 0 }}>
          Learning Analytics
        </Title>
        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => void handleExport()}
          loading={exporting}
        >
          Export CSV
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
        title="AI Review Report"
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
        }}
        footer={[
          <Button
            key="close"
            onClick={() => {
              setIsModalVisible(false);
            }}
          >
            Close
          </Button>,
        ]}
        width={800}
      >
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {selectedReport && typeof selectedReport === 'object' ? (
            <ReactJson
              src={selectedReport}
              displayDataTypes={false}
              displayObjectSize={false}
              name={false}
            />
          ) : (
            <pre>{JSON.stringify(selectedReport, null, 2)}</pre>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default Submissions;
