/* eslint-disable @typescript-eslint/no-unnecessary-condition */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions, @typescript-eslint/prefer-nullish-coalescing */
import React, { useState, useEffect, useMemo } from 'react';
import { Tabs, Input, Select, Button, Typography, Progress, Result, Skeleton, Tag } from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  PlayCircleOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { TaskCard } from '../../components/TaskCard';
import { TaskDetailDrawer } from '../../components/TaskDetailDrawer';
import { TaskDTO, TaskType, TaskDifficulty } from '@lg-agent/contracts';
import { useNavigate, useParams } from 'react-router-dom';
import request from '../../utils/request';
import { trainingService, RecentLearning } from '../../services/trainingService';
import { CourseProgressDTO } from '@lg-agent/contracts';
import { courseService, CourseDTO } from '../../services/courseService';
import { achievementService } from '../../services/achievementService';
import { AchievementDTO } from '@lg-agent/contracts';
import { LearningTimeline } from './LearningTimeline';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

const MissionHub: React.FC = () => {
  const { t } = useTranslation('missionHub');
  const navigate = useNavigate();
  const { courseId } = useParams<{ courseId: string }>();

  // Data states
  const [course, setCourse] = useState<CourseDTO | null>(null);
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [progress, setProgress] = useState<CourseProgressDTO | null>(null);
  const [recent, setRecent] = useState<RecentLearning | null>(null);
  const [achievements, setAchievements] = useState<AchievementDTO | null>(null);

  // UI states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter & Search states
  const [searchText, setSearchText] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('ALL');

  // Drawer states
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskDTO | null>(null);

  // Initialize data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Execute concurrently
        const [courseData, progressData, recentData, achievementsData] = await Promise.all([
          courseService.getCourse(courseId || ''),
          trainingService.getProgress(courseId || ''),
          trainingService.getRecentLearning(),
          achievementService.getMyAchievements(),
        ]);

        setCourse(courseData);
        setProgress(progressData);
        setRecent(recentData);
        setAchievements(achievementsData);

        // Fetch task list separately as it might be large
        const response = await request.get<TaskDTO[]>(`/tasks?courseId=${courseId}`);
        const tasksData = (response as unknown as { data?: TaskDTO[] })?.data ?? response;
        setTasks(Array.isArray(tasksData) ? tasksData : []);
      } catch (err) {
        (window as any).__LAST_ERROR = err instanceof Error ? err.stack : JSON.stringify(err);
        setError(t('errors.loadFailed'));
        console.error('FETCH DATA ERROR:', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const handleEnterWorkspace = (taskId: string) => {
    setDrawerOpen(false);
    navigate(`/course/${courseId}/workspace/${taskId}`);
  };

  const handleTaskClick = (task: TaskDTO) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  // Filter tasks based on search text and difficulty
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch =
        t.title.toLowerCase().includes(searchText.toLowerCase()) ||
        (t.summary?.toLowerCase() ?? '').includes(searchText.toLowerCase());
      const matchDifficulty =
        difficultyFilter === 'ALL' ||
        t.difficulty === (difficultyFilter as unknown as TaskDifficulty);
      return matchSearch && matchDifficulty;
    });
  }, [tasks, searchText, difficultyFilter]);

  const mandatoryTasks = filteredTasks.filter((t) => t.taskType === TaskType.MANDATORY);
  const electiveTasks = filteredTasks.filter((t) => t.taskType === TaskType.ELECTIVE);

  const renderTaskList = (list: TaskDTO[]) => {
    if (list.length === 0) {
      return (
        <div className="py-12 bg-white rounded-lg border border-gray-100 flex flex-col items-center justify-center">
          <BookOutlined className="text-4xl text-gray-300 mb-4" />
          <Text className="text-gray-500">{t('errors.noMissions')}</Text>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map((task) => (
          <TaskCard key={task.id} task={task} onClick={handleTaskClick} />
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 space-y-8">
        <Skeleton active paragraph={{ rows: 2 }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton.Button active className="!h-32 !w-full" />
          <Skeleton.Button active className="!h-32 !w-full" />
          <Skeleton.Button active className="!h-32 !w-full md:col-span-1" />
        </div>
        <Skeleton active title={false} paragraph={{ rows: 1 }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton.Node active className="!h-48 !w-full" />
          <Skeleton.Node active className="!h-48 !w-full" />
          <Skeleton.Node active className="!h-48 !w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-12">
        <Result
          status="500"
          title={t('errors.oops')}
          subTitle={
            <div>
              <p>{error}</p>
              <pre className="text-left mt-4 text-xs text-red-500 max-w-2xl overflow-auto p-4 bg-gray-50 border rounded">
                {(window as any).__LAST_ERROR
                  ? String((window as any).__LAST_ERROR)
                  : t('errors.noDetails')}
              </pre>
            </div>
          }
          extra={
            <Button
              type="primary"
              onClick={() => {
                window.location.reload();
              }}
            >
              {t('actions.tryAgain')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header Section */}
      <div className="mb-8 bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute -right-20 -top-20 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-60 pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex-1">
            <Title level={2} className="!mb-2 !text-gray-800">
              {course?.title ?? t('header.defaultTitle')}
            </Title>
            <Paragraph className="text-gray-500 mb-0 max-w-2xl text-base">
              {course?.description ?? t('header.defaultDesc')}
            </Paragraph>
          </div>

          {progress && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 min-w-[320px]">
              <div className="flex justify-between items-end mb-2">
                <Text className="text-gray-600 font-medium">
                  {t('progress.stage')} {progress.currentStage}
                </Text>
                <Text className="text-lg font-bold text-gray-800">
                  {progress.completedTasks} / {progress.totalTasks} {t('progress.missions')}
                </Text>
              </div>
              <Progress
                percent={progress.progressPercentage}
                strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                status={progress.progressPercentage === 100 ? 'success' : 'active'}
                className="mb-3"
              />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2 rounded shadow-sm border border-gray-100 flex flex-col items-center">
                  <Text className="text-gray-400">{t('progress.successRate')}</Text>
                  <Text className="font-bold text-blue-600">
                    {progress.statistics?.successRate ?? 0}%
                  </Text>
                </div>
                <div className="bg-white p-2 rounded shadow-sm border border-gray-100 flex flex-col items-center">
                  <Text className="text-gray-400">{t('progress.totalPoints')}</Text>
                  <Text className="font-bold text-yellow-600">
                    {achievements?.totalPoints ?? 0}
                  </Text>
                </div>
              </div>

              {achievements && achievements.badges?.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {(achievements.badges || []).map((badge) => (
                    <Tag color="gold" key={badge.badgeCode} className="m-0">
                      🏅 {badge.badgeCode.replace('_', ' ')}
                    </Tag>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Learning Section */}
      {recent && (
        <div className="mb-10">
          <Title level={4} className="!mb-4 flex items-center text-gray-700">
            <PlayCircleOutlined className="mr-2 text-blue-500" /> {t('recent.title')}
          </Title>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-xl p-6 shadow-md text-white flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
              <div className="text-blue-100 text-sm mb-1 font-medium">
                {t('recent.lastAccessed')}
              </div>
              <div className="text-xl font-bold truncate max-w-lg" title={recent.taskTitle}>
                {recent.taskTitle}
              </div>
              <div className="text-blue-200 text-xs mt-2">
                {t('recent.updatedAt')} {new Date(recent.lastAccessTime).toLocaleString()}
              </div>
            </div>
            <Button
              type="primary"
              size="large"
              icon={<PlayCircleOutlined />}
              onClick={() => {
                handleEnterWorkspace(recent.taskId);
              }}
              className="bg-white text-blue-700 hover:bg-gray-50 border-none font-bold shadow-sm whitespace-nowrap"
            >
              {t('actions.resume')}
            </Button>
          </div>
        </div>
      )}

      {/* Tools Section (Search & Filter) */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <Input
          placeholder={t('filters.searchPlaceholder')}
          prefix={<SearchOutlined className="text-gray-400" />}
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
          }}
          className="max-w-md h-10 rounded-lg shadow-sm"
          allowClear
        />
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <FilterOutlined className="text-gray-400" />
          <Select
            value={difficultyFilter}
            onChange={setDifficultyFilter}
            className="w-full sm:w-40 h-10 shadow-sm"
            popupMatchSelectWidth={false}
          >
            <Option value="ALL">{t('filters.all')}</Option>
            <Option value="BEGINNER">{t('filters.beginner')}</Option>
            <Option value="INTERMEDIATE">{t('filters.intermediate')}</Option>
            <Option value="ADVANCED">{t('filters.advanced')}</Option>
          </Select>
        </div>
      </div>

      {/* Missions Tabs Section */}
      <Tabs
        defaultActiveKey="0"
        size="large"
        className="mission-tabs"
        items={[
          {
            key: '0',
            label: <span className="px-4">{t('tabs.journey')}</span>,
            children: (
              <LearningTimeline courseId={courseId || ''} onEnterTask={handleEnterWorkspace} />
            ),
          },
          {
            key: '1',
            label: (
              <span className="px-4">
                {t('tabs.mandatory')} ({mandatoryTasks.length})
              </span>
            ),
            children: <div className="mt-4">{renderTaskList(mandatoryTasks)}</div>,
          },
          {
            key: '2',
            label: (
              <span className="px-4">
                {t('tabs.elective')} ({electiveTasks.length})
              </span>
            ),
            children: <div className="mt-4">{renderTaskList(electiveTasks)}</div>,
          },
        ]}
      />

      <TaskDetailDrawer
        task={selectedTask}
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onEnter={handleEnterWorkspace}
      />
    </div>
  );
};

export default MissionHub;
