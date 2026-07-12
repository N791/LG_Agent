import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Typography } from 'antd';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import {
  statisticsService,
  OverviewStats,
  BlockerStat,
  AiAuditStat,
} from '../../services/statistics';
import { ChartAdapter } from './adapters/chart.adapter';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [trendsData, setTrendsData] = useState<Record<string, unknown>[]>([]);
  const [aiUsageData, setAiUsageData] = useState<Record<string, unknown>[]>([]);
  const [blockers, setBlockers] = useState<BlockerStat[]>([]);
  const [aiAudit, setAiAudit] = useState<AiAuditStat[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, trendsRes, blockersRes, aiUsageRes, aiAuditRes] = await Promise.all([
          statisticsService.getOverview(),
          statisticsService.getLearningTrends(),
          statisticsService.getBlockers(),
          statisticsService.getAiUsage(),
          statisticsService.getAiAudit(),
        ]);

        setOverview(overviewRes);
        setTrendsData(ChartAdapter.toLearningTrendsChart(trendsRes));
        setBlockers(blockersRes);
        setAiUsageData(ChartAdapter.toAiUsageChart(aiUsageRes));
        setAiAudit(aiAuditRes);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const blockerColumns = [
    { title: 'Task ID', dataIndex: 'taskId', key: 'taskId', ellipsis: true },
    { title: 'Task Title', dataIndex: 'taskTitle', key: 'taskTitle' },
    { title: 'Total Attempts', dataIndex: 'totalAttempts', key: 'totalAttempts' },
    { title: 'Failed Attempts', dataIndex: 'failedAttempts', key: 'failedAttempts' },
    {
      title: 'Failure Rate (%)',
      dataIndex: 'failureRate',
      key: 'failureRate',
      render: (val: number) => String(val) + '%',
    },
  ];

  const auditColumns = [
    { title: 'Triggered Rule', dataIndex: 'rule', key: 'rule' },
    { title: 'Trigger Count', dataIndex: 'triggers', key: 'triggers' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>Admin Dashboard</Title>

      {/* Overview Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic title="Total Users" value={overview?.totalUsers} loading={loading} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Total Courses" value={overview?.totalCourses} loading={loading} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic title="Total Tasks" value={overview?.totalTasks} loading={loading} />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Submissions"
              value={overview?.totalSubmissions}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Overall Pass Rate"
              value={overview?.overallPassRate}
              suffix="%"
              precision={2}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Learning Trends */}
        <Col span={12}>
          <Card title="Learning Trends (Submissions)" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Passed" stroke="#52c41a" />
                <Line type="monotone" dataKey="Failed" stroke="#ff4d4f" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* AI Usage */}
        <Col span={12}>
          <Card title="AI Usage by Model (Tokens)" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={aiUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Tokens" fill="#1890ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {/* Blocker Analysis */}
        <Col span={12}>
          <Card title="Top Blockers (Failed Tasks)" loading={loading}>
            <Table
              dataSource={blockers}
              columns={blockerColumns}
              rowKey="taskId"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* AI Audit Logs */}
        <Col span={12}>
          <Card title="Top AI Security Triggers" loading={loading}>
            <Table
              dataSource={aiAudit}
              columns={auditColumns}
              rowKey="rule"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
