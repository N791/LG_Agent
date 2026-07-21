import React, { useState } from 'react';
import { Tabs } from 'antd';
import { ExecutionCenterPanel, ExecutionState } from './ExecutionCenterPanel';
import { useTranslation } from 'react-i18next';

export interface BottomPanelProps {
  executionState: ExecutionState;
}

export const BottomPanel: React.FC<BottomPanelProps> = React.memo(({ executionState }) => {
  const { t } = useTranslation('workspace');
  const [activeTab, setActiveTab] = useState('execution');

  return (
    <div
      className="h-full w-full bg-white border-t border-gray-200 flex flex-col"
      role="region"
      aria-label="Execution and output panel"
    >
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        size="small"
        className="text-gray-700"
        tabBarStyle={{
          margin: 0,
          paddingLeft: 16,
          backgroundColor: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
        }}
        items={[
          {
            key: 'execution',
            label: t('bottomPanel.execution'),
            children: (
              <div className="flex-1 overflow-hidden h-[calc(100%-36px)]">
                <ExecutionCenterPanel state={executionState} />
              </div>
            ),
          },
          {
            key: 'terminal',
            label: t('bottomPanel.terminal.title'),
            children: (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm mt-10">
                {t('bottomPanel.terminal.comingSoon')}
              </div>
            ),
          },
          {
            key: 'problems',
            label: t('bottomPanel.problems.title'),
            children: (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm mt-10">
                {t('bottomPanel.problems.noProblems')}
              </div>
            ),
          },
          {
            key: 'output',
            label: t('bottomPanel.output.title'),
            children: (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm mt-10">
                {t('bottomPanel.output.comingSoon')}
              </div>
            ),
          },
        ]}
      />
    </div>
  );
});
