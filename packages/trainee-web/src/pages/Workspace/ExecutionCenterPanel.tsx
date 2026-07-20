import React, { useEffect, useRef, useState } from 'react';
import { Tabs, Spin, Tag, Descriptions, Card, Progress } from 'antd';
import { ExecutionMetricsDTO } from '@lg-agent/contracts';
import { AIReviewTab } from './AIReviewTab';

export interface ExecutionState {
  mode: 'LIVE' | 'HISTORY';
  submissionId?: string | null;
  status: 'IDLE' | 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ERROR' | 'STOPPED';
  logs: string;
  metrics: ExecutionMetricsDTO | null;
  report: { exitCode?: number | null; message?: string } | null;
  score: number | null;
  error: string | null;
  aiReview?: unknown;
}

export const ExecutionCenterPanel: React.FC<{ state: ExecutionState }> = ({ state }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState('console');

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.logs]);

  useEffect(() => {
    if (state.status === 'FAILED' || state.status === 'ERROR') {
      setActiveTab('review');
    } else if (state.status === 'RUNNING') {
      setActiveTab('console');
    }
  }, [state.status]);

  // Timeline computation based on status
  let progressPercent = 0;
  if (state.status === 'RUNNING') progressPercent = 50;
  if (['SUCCESS', 'FAILED', 'ERROR', 'STOPPED'].includes(state.status)) progressPercent = 100;

  let statusColor = 'blue';
  if (state.status === 'SUCCESS') statusColor = 'green';
  if (state.status === 'FAILED') statusColor = 'red';
  if (state.status === 'ERROR') statusColor = 'volcano';
  if (state.status === 'STOPPED') statusColor = 'orange';

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Timeline Header */}
      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-4 w-1/2">
          <Tag color={statusColor} className="font-mono text-sm uppercase">
            {state.status}
          </Tag>
          {state.status === 'RUNNING' && <Spin size="small" />}
          <Progress 
            percent={progressPercent} 
            showInfo={false} 
            status={state.status === 'RUNNING' ? 'active' : 'normal'}
            strokeColor={
              state.status === 'SUCCESS' ? '#52c41a' : 
              state.status === 'FAILED' ? '#ff4d4f' : 
              state.status === 'ERROR' ? '#ff4d4f' : 
              '#1890ff'
            }
          />
        </div>
        <div className="text-gray-400 font-mono text-xs">
          {state.metrics?.durationMs ? `${(state.metrics.durationMs / 1000).toFixed(2)}s` : '--'}
        </div>
      </div>

      {/* Sub Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        className="flex-1 execution-tabs"
        tabBarStyle={{ paddingLeft: 16, marginBottom: 0 }}
        items={[
          {
            key: 'console',
            label: `Console (${String(state.metrics?.logCount ?? 0)})`,
            children: (
              <div
                ref={scrollRef}
                className="h-[calc(100vh-450px)] p-4 overflow-auto text-gray-300 font-mono text-sm whitespace-pre-wrap bg-[#1e1e1e]"
                style={{ height: '100%', minHeight: 200 }}
              >
                {state.logs || 'No logs yet.'}
              </div>
            ),
          },
          {
            key: 'summary',
            label: 'Summary',
            children: (
              <div className="p-4 overflow-auto bg-gray-50 text-gray-800 h-full">
                {state.metrics ? (
                  <Card size="small" title="Execution Metrics" className="mb-4 bg-white border-gray-200 shadow-sm">
                    <Descriptions column={2} size="small" bordered className="metrics-descriptions bg-white">
                      <Descriptions.Item label="Status">{state.status}</Descriptions.Item>
                      <Descriptions.Item label="Exit Code">{state.metrics.exitCode ?? 'N/A'}</Descriptions.Item>
                      <Descriptions.Item label="Duration (ms)">{state.metrics.durationMs}ms</Descriptions.Item>
                      <Descriptions.Item label="Logs Count">{state.metrics.logCount}</Descriptions.Item>
                      <Descriptions.Item label="Start Time">{new Date(state.metrics.startTime ?? 0).toLocaleTimeString()}</Descriptions.Item>
                      <Descriptions.Item label="End Time">{state.metrics.endTime ? new Date(state.metrics.endTime).toLocaleTimeString() : 'N/A'}</Descriptions.Item>
                      <Descriptions.Item label="Score">{state.score ?? 'N/A'}</Descriptions.Item>
                    </Descriptions>
                  </Card>
                ) : (
                  <div className="text-gray-500">No summary available.</div>
                )}
                {state.report?.message && (
                  <Card size="small" title="Report" className="bg-red-50 border-red-200 mt-4 text-red-700 font-mono shadow-sm">
                    {state.report.message}
                  </Card>
                )}
                {state.error && (
                  <Card size="small" title="System Error" className="bg-red-50 border-red-300 mt-4 text-red-700 font-mono shadow-sm">
                    {state.error}
                  </Card>
                )}
              </div>
            )
          },
          ...((state.status === 'FAILED' || state.status === 'ERROR' || state.aiReview) ? [{
            key: 'review',
            label: 'AI Review',
            children: (
              <AIReviewTab 
                submissionId={state.submissionId ?? ''} 
                initialReview={state.aiReview} 
                status={state.status} 
              />
            )
          }] : [])
        ]}
      />
    </div>
  );
};
