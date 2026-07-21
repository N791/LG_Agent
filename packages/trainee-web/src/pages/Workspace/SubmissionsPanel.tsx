import React, { useEffect, useState } from 'react';
import { Button, Spin, Tag, Typography, message } from 'antd';
import { EyeOutlined, SyncOutlined, CloudUploadOutlined } from '@ant-design/icons';
import request from '../../utils/request';

const { Text } = Typography;

import { ExecutionState } from './ExecutionCenterPanel';
import { useTranslation } from 'react-i18next';

interface SubmissionHistory {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'STOPPED';
  logs?: string;
  report?: { exitCode?: number; message?: string };
  score?: number;
  aiReview?: import('@lg-agent/contracts').AiReviewDTO;
  createdAt: string;
}

interface SubmissionsPanelProps {
  taskId: string;
  setExecutionState?: React.Dispatch<React.SetStateAction<ExecutionState>>;
}

export const SubmissionsPanel: React.FC<SubmissionsPanelProps> = ({
  taskId,
  setExecutionState,
}) => {
  const { t } = useTranslation('workspace');
  const [submissions, setSubmissions] = useState<SubmissionHistory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const data = await request.get<{ data?: SubmissionHistory[] } | SubmissionHistory[]>(
        `/submissions?taskId=${taskId}`,
      );
      setSubmissions(
        (data as unknown as { data?: SubmissionHistory[] }).data ??
          (data as unknown as SubmissionHistory[]),
      );
    } catch (err) {
      console.error('Failed to fetch submissions', err);
      message.error(t('submissionsPanel.messages.loadFailed'));
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
      status: sub.status === 'PASSED' ? 'SUCCESS' : sub.status,
      logs: sub.logs ?? t('submissionsPanel.noLogs'),
      metrics: {
        executionId: sub.id,
        status: sub.status === 'PASSED' ? 'SUCCESS' : sub.status,
        startTime: new Date(sub.createdAt).getTime(),
        endTime: new Date(sub.createdAt).getTime(), // Approximated for history
        durationMs: 0,
        stageDurations: {},
        exitCode: sub.report?.exitCode ?? null,
        retryCount: 0,
        logCount: (sub.logs ?? '').split('\n').length,
      },
      report: sub.report
        ? { exitCode: sub.report.exitCode ?? null, message: sub.report.message }
        : null,
      score: sub.score ?? null,
      error: null,
      aiReview: sub.aiReview,
    });
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-shrink-0 p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-800 m-0 flex items-center gap-2">
          <CloudUploadOutlined /> {t('submissionsPanel.title')}
        </h2>
        <Button
          size="small"
          type="text"
          icon={<SyncOutlined />}
          onClick={() => {
            void fetchSubmissions();
          }}
          loading={loading}
          className="text-gray-500 hover:bg-gray-200"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && submissions.length === 0 ? (
          <div className="flex justify-center p-8">
            <Spin />
          </div>
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-3 mt-10">
            <CloudUploadOutlined className="text-4xl text-gray-200" />
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500 mb-1">
                {t('submissionsPanel.emptyStateTitle')}
              </div>
              <div className="text-xs text-gray-400 max-w-[180px]">
                {t('submissionsPanel.emptyStateDesc')}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-2">
            {submissions.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col p-3 rounded-md mb-1 border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => {
                  handleView(item);
                }}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-700">
                        {item.score !== undefined
                          ? t('submissionsPanel.score', { score: item.score })
                          : t('submissionsPanel.noScore')}
                      </span>
                      <Tag
                        color={
                          item.status === 'PASSED'
                            ? 'green'
                            : item.status === 'FAILED'
                              ? 'red'
                              : 'blue'
                        }
                        className="m-0 text-[10px] leading-tight px-1.5 border-0"
                      >
                        {item.status}
                      </Tag>
                    </div>
                  </div>

                  <Button
                    type="text"
                    size="small"
                    icon={<EyeOutlined />}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 text-xs text-blue-600 hover:bg-blue-50"
                  >
                    {t('submissionsPanel.viewLogs')}
                  </Button>
                </div>
                <Text type="secondary" className="text-xs text-gray-400">
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
