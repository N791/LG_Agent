import React, { useState, useEffect } from 'react';
import { Tabs, Spin, Alert } from 'antd';
import { TaskCard } from '../../components/TaskCard';
import { TaskDTO, TaskType } from '@lg-agent/contracts';
import { useNavigate } from 'react-router-dom';
import request from '../../utils/request';

const MissionHub: React.FC = () => {
  const [tasks, setTasks] = useState<TaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        // Hardcoded course ID for MVP showcase matching the DB seed
        const courseId = '00000000-0000-0000-0000-000000000001';
        const res = await request.get<unknown>(`/tasks?courseId=${courseId}`);
        // Handle NestJS response wrapper { code, message, data }
        const taskData =
          (res as { data?: { data?: TaskDTO[] } }).data?.data ??
          (res as { data?: TaskDTO[] }).data ??
          res;
        setTasks(Array.isArray(taskData) ? taskData : []);
      } catch (_err) {
        setError('Failed to load tasks. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    void fetchTasks();
  }, []);

  const handleEnterWorkspace = (taskId: string) => {
    navigate(`/workspace/${taskId}`);
  };

  const mandatoryTasks = tasks.filter((t) => t.taskType === TaskType.MANDATORY);
  const electiveTasks = tasks.filter((t) => t.taskType === TaskType.ELECTIVE);

  const renderTaskList = (list: TaskDTO[]) => {
    if (list.length === 0) {
      return (
        <div className="text-gray-500 py-8 text-center">No tasks available in this category.</div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.map((task) => (
          <TaskCard key={task.id} task={task} onEnter={handleEnterWorkspace} />
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Mission Hub</h1>
        <p className="text-gray-600 mt-2">Welcome! Here are your training missions.</p>
      </div>

      {loading && (
        <div className="flex justify-center p-12">
          <Spin size="large" />
        </div>
      )}

      {error && <Alert message={error} type="error" showIcon className="mb-6" />}

      {!loading && !error && (
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: '1',
              label: `Mandatory Missions (${String(mandatoryTasks.length)})`,
              children: renderTaskList(mandatoryTasks),
            },
            {
              key: '2',
              label: `Elective Missions (${String(electiveTasks.length)})`,
              children: renderTaskList(electiveTasks),
            },
          ]}
        />
      )}
    </div>
  );
};

export default MissionHub;
