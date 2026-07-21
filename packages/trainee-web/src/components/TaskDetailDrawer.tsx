import React from 'react';
import { Drawer, Button, Tag, Typography, Divider } from 'antd';
import { PlayCircleOutlined, BookOutlined } from '@ant-design/icons';
import { TaskDTO, TaskType, TaskDifficulty } from '@lg-agent/contracts';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

interface TaskDetailDrawerProps {
  task: TaskDTO | null;
  open: boolean;
  onClose: () => void;
  onEnter: (taskId: string) => void;
}

export const TaskDetailDrawer: React.FC<TaskDetailDrawerProps> = ({
  task,
  open,
  onClose,
  onEnter,
}) => {
  const { t } = useTranslation('missionHub');
  const { t: tCommon } = useTranslation('common');
  if (!task) return null;

  return (
    <Drawer
      title={t('drawer.title')}
      placement="right"
      width={480}
      onClose={onClose}
      open={open}
      footer={
        <div className="flex justify-end p-2">
          <Button onClick={onClose} className="mr-4">
            {tCommon('cancel')}
          </Button>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => {
              onEnter(task.id);
            }}
            size="large"
            className="bg-blue-600 hover:bg-blue-500 border-none shadow-md rounded-lg"
          >
            {t('drawer.enterWorkspace')}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col space-y-6">
        <div>
          <Title level={4} className="!mb-1">
            {task.title}
          </Title>
          <div className="flex items-center space-x-2 mt-2">
            <Tag color={task.taskType === TaskType.MANDATORY ? 'red' : 'blue'}>{task.taskType}</Tag>
            <Tag color="purple">
              {t('drawer.stage')} {task.stage}
            </Tag>
            <Tag
              color={
                task.difficulty === TaskDifficulty.ADVANCED
                  ? 'red'
                  : task.difficulty === TaskDifficulty.INTERMEDIATE
                    ? 'orange'
                    : 'green'
              }
            >
              {task.difficulty}
            </Tag>
          </div>
        </div>

        <Divider className="my-0" />

        <div>
          <Title level={5} className="flex items-center text-gray-700 !mb-2">
            <BookOutlined className="mr-2" /> {t('drawer.summary')}
          </Title>
          <Text className="text-gray-600 text-sm">{task.summary ?? t('drawer.noSummary')}</Text>
        </div>

        <div>
          <Title level={5} className="flex items-center text-gray-700 !mb-2">
            {t('drawer.description')}
          </Title>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <Paragraph className="text-sm text-gray-700 whitespace-pre-wrap m-0">
              {task.description ?? t('drawer.noDescription')}
            </Paragraph>
          </div>
        </div>
      </div>
    </Drawer>
  );
};
