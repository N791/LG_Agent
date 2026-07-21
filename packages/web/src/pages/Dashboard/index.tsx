import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table } from 'antd';
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
import { useTranslation } from 'react-i18next';

const Dashboard: React.FC = () => {
  const { t } = useTranslation('dashboard');
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
    { title: t('tables.taskName'), dataIndex: 'taskName', key: 'taskName' },
    { title: t('tables.totalSubmissions'), dataIndex: 'totalSubmissions', key: 'totalSubmissions' },
    {
      title: t('tables.failedSubmissions'),
      dataIndex: 'failedSubmissions',
      key: 'failedSubmissions',
    },
    { title: t('tables.failRate'), dataIndex: 'failRate', key: 'failRate' },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Overview Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={4}>
          <Card>
            <Statistic
              title={t('stats.totalUsers')}
              value={overview?.totalUsers}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title={t('stats.activeTrainees')}
              value={performance?.activeTrainees ?? 0}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title={t('stats.totalTasks')}
              value={overview?.totalTasks}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title={t('stats.totalSubmissions')}
              value={overview?.totalSubmissions}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title={t('stats.overallPassRate')}
              value={performance?.overallPassRate ?? overview?.overallPassRate}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Ramp-up Funnel */}
        <Col span={12}>
          <Card title={t('charts.funnelTitle')} loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnelData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="taskName" type="category" width={100} />
                <Tooltip />
                <Legend />
                <Bar dataKey="passedCount" fill="#8884d8" name={t('charts.passedUsers')} />
                <Bar dataKey="dropOff" fill="#ff4d4f" name={t('charts.dropOffs')} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>

        {/* AI Usage */}
        <Col span={12}>
          <Card title={t('charts.aiUsageTitle')} loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={aiUsageData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="Tokens" fill="#1890ff" name={t('charts.tokens')} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        {/* Blocker Analysis */}
        <Col span={12}>
          <Card title={t('tables.bottlenecksTitle')} loading={loading}>
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
          <Card title={t('charts.learningTrendsTitle')} loading={loading}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="Passed" stroke="#52c41a" name={t('charts.passed')} />
                <Line type="monotone" dataKey="Failed" stroke="#ff4d4f" name={t('charts.failed')} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
