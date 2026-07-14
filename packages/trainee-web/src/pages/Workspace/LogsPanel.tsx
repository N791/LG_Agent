import React, { useEffect, useRef } from 'react';

interface LogsPanelProps {
  logs: string;
}

export const LogsPanel: React.FC<LogsPanelProps> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="h-full w-full bg-[#1e1e1e] border-t border-gray-700 flex flex-col">
      <div className="px-4 py-2 bg-[#2d2d2d] text-gray-300 text-xs font-mono border-b border-gray-700 flex items-center justify-between">
        <span>TERMINAL</span>
      </div>
      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-auto text-gray-300 font-mono text-sm whitespace-pre-wrap"
      >
        {logs || 'Waiting for execution logs...'}
      </div>
    </div>
  );
};
