import React, { useEffect, useState } from 'react';
import { Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { FileOutlined, FolderOutlined } from '@ant-design/icons';
import { workspaceService } from '../../services/workspace/WorkspaceService';
import { FileNode } from '../../services/workspace/WorkspaceRepository';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useParams } from 'react-router-dom';

const mapToFileNode = (node: FileNode): DataNode => {
  return {
    title: node.name,
    key: node.path,
    isLeaf: node.type === 'file',
    icon: node.type === 'file' ? <FileOutlined /> : <FolderOutlined />,
    children: node.children ? node.children.map(mapToFileNode) : undefined,
  };
};

export const FileTree: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const openFile = useWorkspaceStore((state) => state.openFile);

  useEffect(() => {
    if (!taskId) return;
    workspaceService
      .loadWorkspace(taskId)
      .then(() => {
        const nodes = workspaceService.getFileTree();
        setTreeData(nodes.map(mapToFileNode));
      })
      .catch((err: unknown) => {
        console.error(err);
      });
  }, [taskId]);

  const onSelect = (
    selectedKeys: React.Key[],
    info: { node: { isLeaf?: boolean; key: React.Key } },
  ) => {
    if (info.node.isLeaf) {
      const path = info.node.key as string;
      try {
        const content = workspaceService.readFile(path);
        openFile(path, content);
      } catch (err) {
        console.error('Failed to read file:', err);
      }
    }
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col border-r border-gray-200">
      <div className="px-4 py-2 font-bold text-sm text-gray-600 bg-gray-100 border-b border-gray-200">
        EXPLORER
      </div>
      <div className="p-2 flex-1 overflow-y-auto">
        <Tree showIcon defaultExpandAll treeData={treeData} onSelect={onSelect} />
      </div>
    </div>
  );
};
