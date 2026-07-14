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
  analyticsServiceApi,
  FunnelStat,
  BottleneckStat,
  PerformanceStat,
} from '../../services/analytics';
import { statisticsService, OverviewStats } from '../../services/statistics';
import { ChartAdapter } from './adapters/chart.adapter';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const [overview, setOverview] = useState<OverviewStats | null>(null);
  const [trendsData, setTrendsData] = useState<Record<string, unknown>[]>([]);
  const [aiUsageData, setAiUsageData] = useState<Record<string, unknown>[]>([]);

  // New Analytics Data
  const [funnelData, setFunnelData] = useState<FunnelStat[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckStat[]>([]);
  const [performance, setPerformance] = useState<PerformanceStat | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [overviewRes, trendsRes, aiUsageRes, , funnelRes, bottlenecksRes, perfRes] =
          await Promise.all([
            statisticsService.getOverview(),
            statisticsService.getLearningTrends(),
            statisticsService.getAiUsage(),
            statisticsService.getAiAudit(),
            analyticsServiceApi.getFunnel(),
            analyticsServiceApi.getBottlenecks(),
            analyticsServiceApi.getPerformance(),
          ]);

        setOverview(overviewRes);
        setTrendsData(ChartAdapter.toLearningTrendsChart(trendsRes));
        setAiUsageData(ChartAdapter.toAiUsageChart(aiUsageRes));

        setFunnelData(funnelRes);
        setBottlenecks(bottlenecksRes);
        setPerformance(perfRes);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const bottleneckColumns = [
    { title: 'Task Name', dataIndex: 'taskName', key: 'taskName' },
    { title: 'Total Submissions', dataIndex: 'totalSubmissions', key: 'totalSubmissions' },
    { title: 'Failed Submissions', dataIndex: 'failedSubmissions', key: 'failedSubmissions' },
    { title: 'Failure Rate', dataIndex: 'failRate', key: 'failRate' },
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
            <Statistic
              title="Active Trainees"
              value={performance?.activeTrainees ?? 0}
              loading={loading}
            />
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
              value={performance?.overallPassRate ?? overview?.overallPassRate}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Ramp-up Funnel */}
        <Col span={12}>
          <Card title="Ramp-up Funnel (Conversion)" loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="taskName" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="passedCount" fill="#8884d8" name="Passed Users" />
                <Bar dataKey="dropOff" fill="#ff4d4f" name="Drop-offs" />
              </BarChart>
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
          <Card title="Top Bottlenecks (Highest Failure Rates)" loading={loading}>
            <Table
              dataSource={bottlenecks}
              columns={bottleneckColumns}
              rowKey="taskId"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

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
      </Row>
    </div>
  );
};

export default Dashboard;
