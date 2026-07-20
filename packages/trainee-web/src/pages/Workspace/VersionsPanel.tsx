import React, { useEffect, useState } from 'react';
import { List, Button, Spin, Modal, Tag, Typography, message } from 'antd';
import { HistoryOutlined, UndoOutlined } from '@ant-design/icons';
import { WorkspaceVersionDTO } from '@lg-agent/contracts';
import { workspaceService } from '../../services/workspace/WorkspaceService';
import { useWorkspaceStore } from '../../store/workspaceStore';

const { Text } = Typography;

interface VersionsPanelProps {
  taskId: string;
}

export const VersionsPanel: React.FC<VersionsPanelProps> = ({ taskId }) => {
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
      message.error('Failed to load version history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  const handleRestore = (version: WorkspaceVersionDTO) => {
    Modal.confirm({
      title: 'Restore Version?',
      content: `Are you sure you want to restore to version ${version.version}? This will overwrite your current draft.`,
      okText: 'Restore',
      okType: 'danger',
      onOk: async () => {
        setRestoringId(version.id);
        try {
          const workspace = await workspaceService.restoreVersion(taskId, version.id);
          // Reload workspace into store
          workspace.workspace.files.forEach((f) => {
            useWorkspaceStore.getState().openFile(f.path, f.content);
            useWorkspaceStore.getState().markFileSaved(f.path);
          });
          message.success(`Restored to version ${version.version}`);
        } catch (err) {
          console.error(err);
          message.error('Failed to restore version');
        } finally {
          setRestoringId(null);
        }
      },
    });
  };

  const handleCreateVersion = async () => {
    setLoading(true);
    try {
      await workspaceService.createVersion(taskId, 'MANUAL');
      message.success('Version created');
      await fetchVersions();
    } catch (err) {
      console.error(err);
      message.error('Failed to create version');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="p-4 border-b flex justify-between items-center">
        <div className="font-semibold text-gray-700 flex items-center">
          <HistoryOutlined className="mr-2" /> Versions
        </div>
        <Button size="small" type="primary" onClick={() => { void handleCreateVersion(); }}>
          Save Version
        </Button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {loading && !restoringId ? (
          <div className="flex justify-center p-4">
            <Spin />
          </div>
        ) : (
          <List
            dataSource={versions}
            renderItem={(item) => (
              <List.Item
                className="hover:bg-gray-50 transition-colors"
                actions={[
                  <Button
                    key="restore"
                    type="link"
                    size="small"
                    icon={<UndoOutlined />}
                    loading={restoringId === item.id}
                    onClick={() => handleRestore(item)}
                  >
                    Restore
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={
                    <span>
                      Version {item.version}{' '}
                      <Tag
                        color={
                          item.trigger === 'SUBMIT'
                            ? 'green'
                            : item.trigger === 'RUN'
                              ? 'blue'
                              : 'default'
                        }
                        className="ml-2"
                      >
                        {item.trigger}
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
