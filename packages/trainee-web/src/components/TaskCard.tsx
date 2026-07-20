import React from 'react';
import { Card, Tag } from 'antd';
import { TaskDTO, TaskType } from '@lg-agent/contracts';

interface TaskCardProps {
  task: TaskDTO;
  onClick: (task: TaskDTO) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick }) => {
  return (
    <Card
      title={
        <div className="font-semibold text-gray-800 truncate" title={task.title}>
          {task.title}
        </div>
      }
      className="mb-4 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-100 hover:border-blue-200"
      onClick={() => { onClick(task); }}
      extra={
        <Tag color={task.taskType === TaskType.MANDATORY ? 'red' : 'blue'} className="m-0 border-none font-medium">
          {task.taskType}
        </Tag>
      }
    >
      <div className="text-gray-500 mb-4 h-10 line-clamp-2 text-sm">
        {task.summary ?? task.description ?? 'No description provided.'}
      </div>
      <div className="flex justify-between items-center mt-auto pt-4 border-t border-gray-50">
        <span className="text-xs font-medium text-purple-600 bg-purple-50 px-2 py-1 rounded-md">
          Stage {task.stage}
        </span>
        <span className="text-xs font-medium text-gray-500">
          {task.difficulty}
        </span>
      </div>
    </Card>
  );
};
