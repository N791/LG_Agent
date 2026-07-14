import React from 'react';
import { Card, Tag, Button } from 'antd';
import { TaskDTO, TaskType } from '@lg-agent/contracts';

interface TaskCardProps {
  task: TaskDTO;
  onEnter: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onEnter }) => {
  return (
    <Card
      title={task.title}
      className="mb-4 shadow-sm hover:shadow-md transition-shadow"
      extra={
        <Tag color={task.taskType === TaskType.MANDATORY ? 'red' : 'blue'}>{task.taskType}</Tag>
      }
    >
      <p className="text-gray-600 mb-4">{task.description}</p>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500">Stage: {task.stage}</span>
        <Button
          type="primary"
          onClick={() => {
            onEnter(task.id);
          }}
        >
          Enter Workspace
        </Button>
      </div>
    </Card>
  );
};
