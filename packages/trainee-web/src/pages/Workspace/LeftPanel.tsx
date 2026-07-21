import React from 'react';
import { Tabs, Spin } from 'antd';
import {
  FolderOutlined,
  AimOutlined,
  RobotOutlined,
  HistoryOutlined,
  CloudUploadOutlined,
  ReadOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useParams } from 'react-router-dom';
import request from '../../utils/request';
import { TaskDTO } from '@lg-agent/contracts';

import { useWorkspaceStore } from '../../store/workspaceStore';
import { VersionsPanel } from './VersionsPanel';
import { SubmissionsPanel } from './SubmissionsPanel';
import { ChatPanel } from './ChatPanel';
import { KnowledgePanel } from './KnowledgePanel';
import { MentorPanel } from './MentorPanel';
import { FileTree } from './FileTree';

const fetchTask = async (id: string): Promise<TaskDTO> => {
  const res = await request.get<{ data?: TaskDTO } | TaskDTO>(`/tasks/${id}`);
  const data = (res as unknown as { data?: TaskDTO }).data ?? (res as unknown as TaskDTO);
  return data;
};

import { ExecutionState } from './ExecutionCenterPanel';
import { useTranslation } from 'react-i18next';

interface LeftPanelProps {
  setExecutionState?: React.Dispatch<React.SetStateAction<ExecutionState>>;
}

export const LeftPanel: React.FC<LeftPanelProps> = React.memo(({ setExecutionState }) => {
  const { t } = useTranslation('workspace');
  const { taskId } = useParams<{ taskId: string }>();
  const leftPanelTab = useWorkspaceStore((state) => state.leftPanelTab);
  const setLeftPanelTab = useWorkspaceStore((state) => state.setLeftPanelTab);

  const [task, setTask] = React.useState<TaskDTO | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    if (!taskId) return;
    let isMounted = true;
    setIsLoading(true);
    fetchTask(taskId)
      .then((data) => {
        if (isMounted) {
          setTask(data);
          setIsLoading(false);
        }
      })
      .catch((err: unknown) => {
        console.error(err);
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [taskId]);

  const items = [
    {
      key: 'explorer',
      label: (
        <div
          className="flex flex-col items-center justify-center py-2"
          title={t('leftPanel.explorer.title')}
        >
          <FolderOutlined className="text-[20px] mb-1" />
          <span className="text-[10px] font-medium hidden sm:block">
            {t('leftPanel.explorer.label')}
          </span>
        </div>
      ),
      children: <FileTree />,
    },
    {
      key: 'objective',
      label: (
        <div
          className="flex flex-col items-center justify-center py-2"
          title={t('leftPanel.objective.title')}
        >
          <AimOutlined className="text-[20px] mb-1" />
          <span className="text-[10px] font-medium hidden sm:block">
            {t('leftPanel.objective.label')}
          </span>
        </div>
      ),
      children: (
        <div className="flex flex-col h-full bg-white">
          <div className="flex-shrink-0 p-4 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-sm font-semibold text-gray-800 m-0">
              {t('leftPanel.objective.headerTitle')}
            </h2>
            <p className="text-[11px] text-gray-500 m-0 mt-1">
              {t('leftPanel.objective.headerDesc')}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto p-5 bg-white">
            {isLoading ? (
              <div className="flex justify-center items-center h-full text-gray-400 p-8">
                <Spin tip={t('leftPanel.objective.loading')} />
              </div>
            ) : task?.description ? (
              <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700">
                <Markdown remarkPlugins={[remarkGfm]}>{task.description}</Markdown>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <AimOutlined className="text-3xl text-gray-200" />
                <span className="text-sm">{t('leftPanel.objective.noObjective')}</span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'mentor',
      label: (
        <div
          className="flex flex-col items-center justify-center py-2"
          title={t('leftPanel.mentor.title')}
        >
          <RobotOutlined className="text-[20px] mb-1" />
          <span className="text-[10px] font-medium hidden sm:block">
            {t('leftPanel.mentor.label')}
          </span>
        </div>
      ),
      children: taskId ? (
        <ChatPanel taskId={taskId} />
      ) : (
        <div className="p-4">{t('leftPanel.noTask')}</div>
      ),
    },
    {
      key: 'versions',
      label: (
        <div
          className="flex flex-col items-center justify-center py-2"
          title={t('leftPanel.versions.title')}
        >
          <HistoryOutlined className="text-[20px] mb-1" />
          <span className="text-[10px] font-medium hidden sm:block">
            {t('leftPanel.versions.label')}
          </span>
        </div>
      ),
      children: (
        <div className="h-full bg-white">{taskId && <VersionsPanel taskId={taskId} />}</div>
      ),
    },
    {
      key: 'submissions',
      label: (
        <div
          className="flex flex-col items-center justify-center py-2"
          title={t('leftPanel.submissions.title')}
        >
          <CloudUploadOutlined className="text-[20px] mb-1" />
          <span className="text-[10px] font-medium hidden sm:block">
            {t('leftPanel.submissions.label')}
          </span>
        </div>
      ),
      children: (
        <div className="h-full bg-white">
          {taskId && <SubmissionsPanel taskId={taskId} setExecutionState={setExecutionState} />}
        </div>
      ),
    },
    {
      key: 'knowledge',
      label: (
        <div
          className="flex flex-col items-center justify-center py-2"
          title={t('leftPanel.knowledge.title')}
        >
          <ReadOutlined className="text-[20px] mb-1" />
          <span className="text-[10px] font-medium hidden sm:block">
            {t('leftPanel.knowledge.label')}
          </span>
        </div>
      ),
      children: <KnowledgePanel />,
    },
    {
      key: 'mentor-human',
      label: (
        <div
          className="flex flex-col items-center justify-center py-2"
          title={t('leftPanel.mentorHuman.title')}
        >
          <TeamOutlined className="text-[20px] mb-1" />
          <span className="text-[10px] font-medium hidden sm:block">
            {t('leftPanel.mentorHuman.label')}
          </span>
        </div>
      ),
      children: taskId ? (
        <MentorPanel taskId={taskId} />
      ) : (
        <div className="p-4">{t('leftPanel.noTask')}</div>
      ),
    },
  ];

  return (
    <div
      className="h-full bg-white flex flex-col left-panel-activity-bar"
      role="region"
      aria-label="Workspace left panel"
    >
      <Tabs
        activeKey={leftPanelTab}
        onChange={(key) => {
          setLeftPanelTab(
            key as
              | 'explorer'
              | 'objective'
              | 'mentor'
              | 'versions'
              | 'submissions'
              | 'knowledge'
              | 'mentor-human',
          );
        }}
        items={items}
        tabPosition="left"
        className="h-full left-panel-tabs [&>.ant-tabs-nav]:w-[60px] sm:[&>.ant-tabs-nav]:w-[70px] [&>.ant-tabs-nav]:bg-slate-50 [&>.ant-tabs-nav]:border-r [&>.ant-tabs-nav]:border-slate-200 [&_.ant-tabs-tab-active]:bg-slate-200/50 [&_.ant-tabs-tab-active]:border-l-4 [&_.ant-tabs-tab-active]:border-l-blue-600"
        tabBarGutter={0}
        style={{ height: '100%' }}
      />
    </div>
  );
});
