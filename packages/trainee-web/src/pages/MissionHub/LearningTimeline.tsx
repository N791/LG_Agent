import React, { useEffect, useState } from 'react';
import { Timeline, Typography, Tag, Button, Spin, Alert } from 'antd';
import { CheckCircleOutlined, LockOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { TimelineNodeDTO } from '@lg-agent/contracts';
import { trainingService } from '../../services/trainingService';

const { Text } = Typography;

interface LearningTimelineProps {
  courseId: string;
  onEnterTask: (taskId: string) => void;
}

export const LearningTimeline: React.FC<LearningTimelineProps> = ({ courseId, onEnterTask }) => {
  const [nodes, setNodes] = useState<TimelineNodeDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        setLoading(true);
        const data = await trainingService.getTimeline(courseId);
        setNodes(data);
      } catch (err) {
        setError('Failed to load learning timeline.');
      } finally {
        setLoading(false);
      }
    };
    if (courseId) {
      void fetchTimeline();
    }
  }, [courseId]);

  if (loading) {
    return <div className="py-12 flex justify-center"><Spin size="large" /></div>;
  }

  if (error) {
    return <Alert type="error" message={error} className="my-4" />;
  }

  if (nodes.length === 0) {
    return <Text className="text-gray-500">No missions found for this course.</Text>;
  }

  const timelineItems = nodes.map((node) => {
    let color = 'gray';
    let icon = <LockOutlined />;
    
    if (node.status === 'PASSED') {
      color = 'green';
      icon = <CheckCircleOutlined />;
    } else if (node.status === 'AVAILABLE') {
      color = 'blue';
      icon = <PlayCircleOutlined />;
    }

    return {
      color,
      dot: <div className="text-xl">{icon}</div>,
      children: (
        <div className={`ml-2 mb-8 ${node.status === 'LOCKED' ? 'opacity-50' : ''}`}>
          <div className="flex items-center gap-3 mb-2">
            <Text className="font-bold text-lg">{node.title}</Text>
            <Tag color={color}>Stage {node.stage}</Tag>
            {node.status === 'PASSED' && <Tag color="success">Completed</Tag>}
          </div>
          
          {node.status !== 'LOCKED' && (
            <Button 
              type={node.status === 'AVAILABLE' ? 'primary' : 'default'} 
              size="small" 
              onClick={() => onEnterTask(node.taskId)}
            >
              {node.status === 'PASSED' ? 'Review Mission' : 'Start Mission'}
            </Button>
          )}
        </div>
      )
    };
  });

  return (
    <div className="max-w-2xl mt-8">
      <Timeline items={timelineItems} />
    </div>
  );
};
