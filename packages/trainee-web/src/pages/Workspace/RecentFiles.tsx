import React from 'react';
import { useWorkspaceSession, workspaceSessionCommands } from '../../modules/workspace-session';
import { FileOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export const RecentFiles: React.FC = () => {
  const { t } = useTranslation('workspace');
  const recentFiles = useWorkspaceSession((state) => state.recentFiles);
  const activeFile = useWorkspaceSession((state) => state.activeFile);

  if (recentFiles.length === 0) return null;

  const handleOpen = (path: string) => {
    workspaceSessionCommands.open(path);
  };

  return (
    <div className="border-b border-gray-200">
      <div className="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-50 uppercase tracking-wider">
        {t('fileTree.recentFiles')}
      </div>
      <div className="py-1">
        {recentFiles.map((path) => {
          const parts = path.split('/');
          const name = parts[parts.length - 1];
          const isActive = path === activeFile;

          return (
            <div
              key={path}
              className={`px-4 py-1 text-sm cursor-pointer flex items-center gap-2 hover:bg-gray-100 ${
                isActive ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
              }`}
              onClick={() => {
                handleOpen(path);
              }}
              title={path}
            >
              <FileOutlined className={isActive ? 'text-blue-500' : 'text-gray-400'} />
              <span className="truncate">{name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
