/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
import React, { useEffect, useState } from 'react';
import { Card, Typography, Row, Col, Progress, Tag, Skeleton, Result, Button } from 'antd';
import {
  PlayCircleOutlined,
  TrophyOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  ThunderboltOutlined,
  CalendarOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { trainingService, RecentLearning } from '../../services/trainingService';
import { DashboardCourseDTO, DashboardStatisticsDTO } from '@lg-agent/contracts';
import { TopNavbar } from '../../components/TopNavbar';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('dashboard');

  const [courses, setCourses] = useState<DashboardCourseDTO[]>([]);
  const [stats, setStats] = useState<DashboardStatisticsDTO | null>(null);
  const [recent, setRecent] = useState<RecentLearning | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [coursesData, statsData, recentData] = await Promise.all([
          trainingService.getMyCourses(),
          trainingService.getOverallStatistics(),
          trainingService.getRecentLearning(),
        ]);

        setCourses(coursesData);
        setStats(statsData);
        setRecent(recentData);
      } catch (err) {
        setError(t('errors.loadFailed', 'Failed to load dashboard data.'));
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <TopNavbar />
        <div className="flex-1 max-w-7xl mx-auto w-full p-6 space-y-8">
          <Skeleton active paragraph={{ rows: 2 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <TopNavbar />
        <div className="flex-1 flex items-center justify-center">
          <Result
            status="500"
            title={t('errors.oops', 'Oops, something went wrong!')}
            subTitle={error}
            extra={
              <Button
                type="primary"
                onClick={() => {
                  window.location.reload();
                }}
              >
                {t('errors.tryAgain', 'Try Again')}
              </Button>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <TopNavbar />

      <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Welcome Section */}
        <div>
          <Title level={2} className="!mb-1">
            {t('welcomeTitle', 'Welcome back, Learner!')}
          </Title>
          <Text className="text-gray-500 text-lg">
            {t('welcomeSubtitle', 'Pick up where you left off or start a new adventure.')}
          </Text>
        </div>

        {/* Global Statistics */}
        {stats && (
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Card className="shadow-sm border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                    <TrophyOutlined className="text-xl" />
                  </div>
                  <div>
                    <Text className="text-gray-400 text-xs block">
                      {t('stats.totalPoints', 'Total Points')}
                    </Text>
                    <Text className="text-2xl font-bold text-gray-800">{stats.totalPoints}</Text>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="shadow-sm border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center text-green-500">
                    <CheckCircleOutlined className="text-xl" />
                  </div>
                  <div>
                    <Text className="text-gray-400 text-xs block">
                      {t('stats.successRate', 'Success Rate')}
                    </Text>
                    <Text className="text-2xl font-bold text-gray-800">{stats.successRate}%</Text>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="shadow-sm border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                    <ThunderboltOutlined className="text-xl" />
                  </div>
                  <div>
                    <Text className="text-gray-400 text-xs block">
                      {t('stats.aiUsage', 'AI Usage')}
                    </Text>
                    <Text className="text-2xl font-bold text-gray-800">{stats.aiUsage}</Text>
                  </div>
                </div>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="shadow-sm border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-orange-500">
                    <CalendarOutlined className="text-xl" />
                  </div>
                  <div>
                    <Text className="text-gray-400 text-xs block">
                      {t('stats.activeDays', 'Active Days')}
                    </Text>
                    <Text className="text-2xl font-bold text-gray-800">{stats.activeDays}</Text>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content: Courses */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex justify-between items-end">
              <Title level={4} className="!mb-0">
                <BookOutlined className="mr-2" /> {t('courses.title', 'My Courses')}
              </Title>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {courses.map((course) => (
                <Card
                  key={course.courseId}
                  className={`border border-gray-200 shadow-sm transition-all ${course.status === 'LOCKED' ? 'opacity-60 bg-gray-50' : 'hover:shadow-md cursor-pointer hover:border-blue-300'}`}
                  onClick={() => {
                    if (course.status !== 'LOCKED') {
                      navigate(`/mission-hub/${course.courseId}`);
                    }
                  }}
                  styles={{ body: { padding: '20px' } }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <Text className="font-bold text-lg leading-tight w-3/4 truncate">
                      {course.title}
                    </Text>
                    {course.status === 'COMPLETED' && (
                      <Tag color="green">{t('courses.status.completed', 'Completed')}</Tag>
                    )}
                    {course.status === 'ENROLLED' && (
                      <Tag color="blue">{t('courses.status.inProgress', 'In Progress')}</Tag>
                    )}
                    {course.status === 'AVAILABLE' && (
                      <Tag color="default">{t('courses.status.available', 'Available')}</Tag>
                    )}
                    {course.status === 'LOCKED' && (
                      <Tag color="red">{t('courses.status.locked', 'Locked')}</Tag>
                    )}
                  </div>
                  <Paragraph className="text-gray-500 text-sm h-10 overflow-hidden line-clamp-2 mb-4">
                    {course.description ||
                      t('courses.noDescription', 'No description available for this course.')}
                  </Paragraph>

                  {course.status !== 'LOCKED' ? (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>{t('courses.progress', 'Progress')}</span>
                        <span>{course.progressPercentage}%</span>
                      </div>
                      <Progress
                        percent={course.progressPercentage}
                        showInfo={false}
                        size="small"
                        strokeColor={course.progressPercentage === 100 ? '#52c41a' : '#1890ff'}
                      />
                    </div>
                  ) : (
                    <div className="pt-2 text-xs text-red-500 font-medium">
                      {t('courses.requiresPoints', {
                        points: course.requiredPoints,
                        defaultValue: `Requires ${String(course.requiredPoints)} points to unlock`,
                      })}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </div>

          {/* Sidebar: Recent Activity */}
          <div className="space-y-6">
            <Title level={4} className="!mb-0">
              <HistoryOutlined className="mr-2" /> {t('recent.title', 'Recent Activity')}
            </Title>
            {recent ? (
              <Card className="shadow-sm border-blue-100 bg-blue-50/30">
                <Text className="text-xs text-blue-500 uppercase font-bold tracking-wider mb-2 block">
                  {t('recent.resumeLearning', 'Resume Learning')}
                </Text>
                <Title level={5} className="!mt-0 !mb-1">
                  {recent.taskTitle}
                </Title>
                <Text className="text-gray-500 text-sm block mb-4">
                  {t('recent.lastActive', 'Last active:')}{' '}
                  {new Date(recent.lastAccessTime).toLocaleDateString()} at{' '}
                  {new Date(recent.lastAccessTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  className="w-full"
                  onClick={() => {
                    navigate(`/course/${recent.courseId}/workspace/${recent.taskId}`);
                  }}
                >
                  {t('recent.continueWorkspace', 'Continue Workspace')}
                </Button>
              </Card>
            ) : (
              <Card className="shadow-sm bg-gray-50 border-gray-100 text-center py-6">
                <Text className="text-gray-400">
                  {t('recent.noActivity', 'No recent activity found.')}
                </Text>
                <br />
                <Text className="text-gray-400 text-sm">
                  {t('recent.startCourse', 'Start a course to see your progress here.')}
                </Text>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
