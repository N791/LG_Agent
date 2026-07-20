import React, { useEffect, useState } from 'react';
import { Table, Card, Typography, Tabs, Tag } from 'antd';
import request from '../../utils/request';


const { Title, Text } = Typography;

export default function Observability() {
  const [logs, setLogs] = useState<Record<string, unknown>[]>([]);
  const [metrics, setMetrics] = useState<Record<string, unknown>[]>([]);
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [logsRes, metricsRes, auditRes] = await Promise.all([
          request.get('/telemetry/logs?limit=50'),
          request.get('/telemetry/metrics?limit=50'),
          request.get('/observability/audit?limit=50'),
        ]);
        setLogs((logsRes as { data?: Record<string, unknown>[] }).data ?? (logsRes as Record<string, unknown>[]));
        setMetrics((metricsRes as { data?: Record<string, unknown>[] }).data ?? (metricsRes as Record<string, unknown>[]));
        setAuditLogs((auditRes as { data?: Record<string, unknown>[] }).data ?? (auditRes as Record<string, unknown>[]));
      } catch (err) {
        console.error('Failed to load telemetry data', err);
      } finally {
        setLoading(false);
      }
    };
    void fetchData();
  }, []);

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'ERROR': return 'red';
      case 'WARN': return 'orange';
      case 'INFO': return 'blue';
      default: return 'default';
    }
  };

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'green';
      case 'needs-improvement': return 'orange';
      case 'poor': return 'red';
      default: return 'default';
    }
  };

  const logColumns = [
    {
      title: 'Level',
      dataIndex: 'level',
      key: 'level',
      render: (level: string) => <Tag color={getLevelColor(level)}>{level}</Tag>,
      width: 100,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
    },
    {
      title: 'Path',
      dataIndex: 'path',
      key: 'path',
      width: 150,
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
      width: 200,
    },
  ];

  const metricColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (val: number) => val.toFixed(2),
      width: 100,
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      render: (rating: string) => rating ? <Tag color={getRatingColor(rating)}>{rating}</Tag> : '-',
      width: 150,
    },
    {
      title: 'Path',
      dataIndex: 'path',
      key: 'path',
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
      width: 200,
    },
  ];

  const auditColumns = [
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => <Tag color="geekblue">{action}</Tag>,
      width: 150,
    },
    {
      title: 'Actor ID',
      dataIndex: 'actorId',
      key: 'actorId',
      render: (id: string) => <Text copyable>{id || 'System'}</Text>,
      width: 150,
    },
    {
      title: 'Resource ID',
      dataIndex: 'resourceId',
      key: 'resourceId',
      width: 150,
    },
    {
      title: 'Trace ID',
      dataIndex: 'traceId',
      key: 'traceId',
      render: (id: string) => id ? <Text copyable>{id}</Text> : '-',
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
      width: 200,
    },
  ];

  const items = [
    {
      key: 'metrics',
      label: 'Client Metrics',
      children: (
        <Table 
          dataSource={metrics} 
          columns={metricColumns} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'logs',
      label: 'Client Logs',
      children: (
        <Table 
          dataSource={logs} 
          columns={logColumns} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
    {
      key: 'audit',
      label: 'Audit Logs',
      children: (
        <Table 
          dataSource={auditLogs} 
          columns={auditColumns} 
          rowKey="id" 
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex justify-between items-center">
        <div>
          <Title level={2} className="!mb-1">Frontend Observability</Title>
          <Text type="secondary">Monitor client telemetry, web vitals, and errors in real-time.</Text>
        </div>
      </div>
      
      <Card>
        <Tabs defaultActiveKey="metrics" items={items} />
      </Card>
    </div>
  );
}
