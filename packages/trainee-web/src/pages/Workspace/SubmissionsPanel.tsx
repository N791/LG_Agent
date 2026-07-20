import React, { useEffect, useState } from 'react';
import { Button, Spin, Tag, Typography, message } from 'antd';
import { VirtualizedList } from '../../components/VirtualizedList';
import { List } from 'antd'; // keep for List.Item
import { HistoryOutlined, EyeOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const { Text } = Typography;

import { ExecutionState } from './ExecutionCenterPanel';

interface SubmissionHistory {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'STOPPED';
  logs?: string;
  report?: { exitCode?: number; message?: string };
  score?: number;
  aiReview?: string;
  createdAt: string;
}

interface SubmissionsPanelProps {
  taskId: string;
  setExecutionState?: React.Dispatch<React.SetStateAction<ExecutionState>>;
}

export const SubmissionsPanel: React.FC<SubmissionsPanelProps> = ({ taskId, setExecutionState }) => {
  const [submissions, setSubmissions] = useState<SubmissionHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const data = await request.get<{ data?: SubmissionHistory[] } | SubmissionHistory[]>(`/submissions?taskId=${taskId}`);
      setSubmissions((data as { data?: SubmissionHistory[] }).data ?? (data as SubmissionHistory[]));
    } catch (err) {
      console.error('Failed to fetch submissions', err);
      message.error('Failed to load submission history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSubmissions();
  }, [taskId]);

  const handleView = (sub: SubmissionHistory) => {
    if (!setExecutionState) return;
    
    setExecutionState({
      mode: 'HISTORY',
      submissionId: sub.id,
      status: sub.status,
      logs: sub.logs ?? 'No logs available for this submission.',
      metrics: {
        executionId: sub.id,
        status: sub.status,
        startTime: new Date(sub.createdAt).getTime(),
        endTime: new Date(sub.createdAt).getTime(), // Approximated for history
        durationMs: 0,
        stageDurations: {},
        exitCode: sub.report?.exitCode ?? null,
        retryCount: 0,
        logCount: (sub.logs ?? '').split('\n').length,
      },
      report: sub.report,
      score: sub.score,
      error: null,
      aiReview: sub.aiReview,
    });
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="font-semibold text-gray-700 flex items-center">
          <HistoryOutlined className="mr-2" /> Submissions
        </div>
        <Button size="small" type="primary" onClick={() => { void fetchSubmissions(); }}>
          Refresh
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex justify-center p-4">
            <Spin />
          </div>
        ) : (
          <VirtualizedList
            data={submissions}
            height={400}
            emptyText="No previous submissions found."
            renderItem={(item: SubmissionHistory) => (
              <List.Item
                className="hover:bg-gray-50 transition-colors"
                actions={[
                  <Button
                    key="view"
                    type="link"
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => { handleView(item); }}
                  >
                    View
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span>
                      Score: {item.score}{' '}
                      <Tag
                        color={
                          item.status === 'PASSED'
                            ? 'green'
                            : item.status === 'FAILED'
                              ? 'red'
                              : 'blue'
                        }
                        className="ml-2"
                      >
                        {item.status}
                      </Tag>
                    </span>
                  }
                  description={<Text type="secondary" className="text-xs">{new Date(item.createdAt).toLocaleString()}</Text>}
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};
