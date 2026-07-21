import React, { useEffect, useState } from 'react';
import { Button, Spin, Tag, Typography, message } from 'antd';
import { HistoryOutlined, UndoOutlined, PlusOutlined } from '@ant-design/icons';
import { WorkspaceVersionDTO } from '@lg-agent/contracts';
import { workspaceService } from '../../services/workspace/WorkspaceService';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

interface VersionsPanelProps {
  taskId: string;
}

export const VersionsPanel: React.FC<VersionsPanelProps> = ({ taskId }) => {
  const { t } = useTranslation('workspace');
  const [versions, setVersions] = useState<WorkspaceVersionDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const data = await workspaceService.getVersions(taskId);
      setVersions(data);
    } catch (err) {
      console.error('Failed to fetch versions', err);
      message.error(t('versionsPanel.messages.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVersions();
  }, [taskId]);

  const handleRestore = (version: WorkspaceVersionDTO) => {
    if (!window.confirm(t('versionsPanel.confirmRestore', { version: String(version.version) }))) {
      return;
    }

    setRestoringId(version.id);
    workspaceService
      .restoreVersion(taskId, version.id)
      .then((workspace) => {
        // Reload workspace into store
        workspace.workspace.files.forEach((f) => {
          useWorkspaceStore.getState().openFile(f.path, f.content);
          useWorkspaceStore.getState().markFileSaved(f.path);
        });
        message.success(
          t('versionsPanel.messages.restoreSuccess', { version: String(version.version) }),
        );
      })
      .catch((err: unknown) => {
        console.error(err);
        message.error(t('versionsPanel.messages.restoreFailed'));
      })
      .finally(() => {
        setRestoringId(null);
      });
  };

  const handleCreateVersion = async () => {
    setLoading(true);
    try {
      await workspaceService.createVersion(taskId, 'MANUAL');
      message.success(t('versionsPanel.messages.createSuccess'));
      await fetchVersions();
    } catch (err) {
      console.error(err);
      message.error(t('versionsPanel.messages.createFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="flex-shrink-0 p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <h2 className="text-sm font-semibold text-gray-800 m-0 flex items-center gap-2">
          <HistoryOutlined /> {t('versionsPanel.title')}
        </h2>
        <Button
          size="small"
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            void handleCreateVersion();
          }}
          className="text-[11px] h-7 flex items-center"
        >
          {t('versionsPanel.createVersion')}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && !restoringId ? (
          <div className="flex justify-center p-8">
            <Spin />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-3 mt-10">
            <HistoryOutlined className="text-4xl text-gray-200" />
            <div className="text-center">
              <div className="text-sm font-medium text-gray-500 mb-1">
                {t('versionsPanel.emptyStateTitle')}
              </div>
              <div className="text-xs text-gray-400 max-w-[180px]">
                {t('versionsPanel.emptyStateDesc')}
              </div>
            </div>
            <Button
              size="small"
              className="mt-2"
              onClick={() => {
                void handleCreateVersion();
              }}
            >
              {t('versionsPanel.createNow')}
            </Button>
          </div>
        ) : (
          <div className="p-2">
            {versions.map((item) => (
              <div
                key={item.id}
                className="group relative flex flex-col p-3 rounded-md mb-1 border border-transparent hover:border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">
                      {t('versionsPanel.version', { version: item.version })}
                    </span>
                    <Tag
                      color={
                        item.trigger === 'SUBMIT'
                          ? 'green'
                          : item.trigger === 'RUN'
                            ? 'blue'
                            : 'default'
                      }
                      className="m-0 text-[10px] leading-tight px-1.5 border-0"
                    >
                      {item.trigger}
                    </Tag>
                  </div>

                  <Button
                    type="text"
                    size="small"
                    icon={<UndoOutlined />}
                    loading={restoringId === item.id}
                    onClick={() => {
                      handleRestore(item);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity h-6 px-2 text-xs text-blue-600 hover:bg-blue-50"
                  >
                    {t('versionsPanel.restore')}
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
