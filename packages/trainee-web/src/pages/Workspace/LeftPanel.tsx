import React from 'react';
import { Tabs } from 'antd';
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

const fetchTask = async (id: string): Promise<TaskDTO> => {
  const res = await request.get<{ data?: TaskDTO } | TaskDTO>(`/tasks/${id}`);
  const data = (res as unknown as { data?: TaskDTO }).data ?? (res as unknown as TaskDTO);
  return data;
};

import { ExecutionState } from './ExecutionCenterPanel';

interface LeftPanelProps {
  setExecutionState?: React.Dispatch<React.SetStateAction<ExecutionState>>;
}

export const LeftPanel: React.FC<LeftPanelProps> = React.memo(({ setExecutionState }) => {
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
      key: 'objective',
      label: '任务目标',
      children: (
        <div className="p-4 overflow-y-auto h-full">
          {isLoading ? (
            <div>Loading...</div>
          ) : (
            <div className="prose prose-sm dark:prose-invert">
              <Markdown remarkPlugins={[remarkGfm]}>{task?.description ?? '暂无任务说明'}</Markdown>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'mentor',
      label: 'AI 导师',
      children: taskId ? <ChatPanel taskId={taskId} /> : <div>No Task</div>,
    },
    {
      key: 'versions',
      label: '版本历史',
      children: (
        <div className="h-full">
          {taskId && <VersionsPanel taskId={taskId} />}
        </div>
      ),
    },
    {
      key: 'submissions',
      label: '提交记录',
      children: (
        <div className="h-full">
          {taskId && <SubmissionsPanel taskId={taskId} setExecutionState={setExecutionState} />}
        </div>
      ),
    },
    {
      key: 'knowledge',
      label: '知识库',
      children: <KnowledgePanel />,
    },
    {
      key: 'mentor-human',
      label: '导师讨论',
      children: taskId ? <MentorPanel taskId={taskId} /> : <div>No Task</div>,
    },
  ];

  return (
    <div className="h-full bg-white flex flex-col" role="region" aria-label="Workspace left panel">
      <Tabs
        activeKey={leftPanelTab}
        onChange={(key) => {
          setLeftPanelTab(key as "objective" | "mentor" | "versions" | "submissions" | "knowledge" | "mentor-human");
        }}
        items={items}
        className="h-full px-2"
        tabBarGutter={8}
      />
    </div>
  );
});
