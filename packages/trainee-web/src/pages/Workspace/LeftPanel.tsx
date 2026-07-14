import React from 'react';
import { Tabs } from 'antd';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useParams } from 'react-router-dom';
import request from '../../utils/request';
import { TaskDTO } from '@lg-agent/contracts';

import { useWorkspaceStore } from '../../store/workspaceStore';

const fetchTask = async (id: string): Promise<TaskDTO> => {
  const res = await request.get<{ data?: TaskDTO } | TaskDTO>(`/tasks/${id}`);
  const data = (res as { data?: TaskDTO }).data ?? (res as TaskDTO);
  return data;
};

export const LeftPanel: React.FC = () => {
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
      children: (
        <div className="p-4 overflow-y-auto h-full">
          {useWorkspaceStore((state) => state.aiHistory).length > 0 && (
            <div className="mb-4 space-y-4">
              {useWorkspaceStore((state) => state.aiHistory).map(
                (msg: { id: string; role: string; content: string }) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-50 ml-4' : 'bg-gray-50 mr-4'}`}
                  >
                    <span className="text-xs font-bold text-gray-500 uppercase">{msg.role}</span>
                    <Markdown
                      remarkPlugins={[remarkGfm]}
                      className="prose prose-sm dark:prose-invert"
                    >
                      {msg.content}
                    </Markdown>
                  </div>
                ),
              )}
            </div>
          )}
          {useWorkspaceStore((state) => state.aiLoading) &&
          !useWorkspaceStore((state) => state.aiFeedback) ? (
            <div className="flex flex-col items-center justify-center text-gray-500 h-full space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <p>AI Mentor is analyzing your code...</p>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert">
              {useWorkspaceStore((state) => state.aiFeedback) ? (
                <div className="bg-gray-50 p-3 rounded-lg mr-4">
                  <span className="text-xs font-bold text-gray-500 uppercase">
                    assistant (streaming)
                  </span>
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {useWorkspaceStore((state) => state.aiFeedback)}
                  </Markdown>
                </div>
              ) : (
                useWorkspaceStore((state) => state.aiHistory).length === 0 && (
                  <div className="flex flex-col h-full items-center justify-center text-gray-500 pt-20">
                    <p>Run your code to get AI Mentor feedback!</p>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="h-full bg-white flex flex-col">
      <Tabs
        activeKey={leftPanelTab}
        onChange={(key) => {
          setLeftPanelTab(key as 'objective' | 'mentor');
        }}
        items={items}
        className="h-full px-2"
      />
    </div>
  );
};
