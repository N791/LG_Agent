import React from 'react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { workspaceService } from '../../services/workspace/WorkspaceService';
import { FileOutlined } from '@ant-design/icons';

export const RecentFiles: React.FC = () => {
  const recentFiles = useWorkspaceStore((state) => state.recentFiles);
  const openFile = useWorkspaceStore((state) => state.openFile);
  const activeFile = useWorkspaceStore((state) => state.activeFile);

  if (recentFiles.length === 0) return null;

  const handleOpen = (path: string) => {
    try {
      const content = workspaceService.readFile(path);
      openFile(path, content);
    } catch (err) {
      console.error('Failed to read file:', err);
    }
  };

  return (
    <div className="border-b border-gray-200">
      <div className="px-4 py-2 text-xs font-bold text-gray-500 bg-gray-50 uppercase tracking-wider">
        Recent Files
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
              onClick={() => { handleOpen(path); }}
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
