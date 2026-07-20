import React, { useEffect, useState } from 'react';
import { Tree, Input, Dropdown, MenuProps, Modal, message } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { workspaceService } from '../../services/workspace/WorkspaceService';
import { WorkspaceTreeService } from '../../services/workspace/WorkspaceTreeService';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useParams } from 'react-router-dom';
import { WorkspaceFileDTO } from '@lg-agent/contracts';
import { RecentFiles } from './RecentFiles';

const { Search } = Input;

export const FileTree: React.FC = React.memo(() => {
  const { taskId } = useParams<{ taskId: string }>();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [autoExpandParent, setAutoExpandParent] = useState(true);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'new_file' | 'new_folder' | 'rename' | null>(null);
  const [targetPath, setTargetPath] = useState<string>('');
  const [inputValue, setInputValue] = useState('');

  const openFile = useWorkspaceStore((state) => state.openFile);
  const closeFile = useWorkspaceStore((state) => state.closeFile);
  const activeFile = useWorkspaceStore((state) => state.activeFile);

  const fetchTree = () => {
    const files = workspaceService.currentWorkspace?.workspace.files ?? [];
    const nodes = WorkspaceTreeService.buildTree(files);
    setTreeData(nodes);
  };

  useEffect(() => {
    if (!taskId) return;
    workspaceService
      .loadWorkspace(taskId)
      .then(() => {
        fetchTree();
      })
      .catch((err: unknown) => {
        console.error(err);
      });
  }, [taskId]);

  const onSelect = (
    _selectedKeys: React.Key[],
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

  const getParentPath = (path: string) => {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/');
  };

  const handleModalSubmit = async () => {
    if (!taskId || !inputValue) return;
    try {
      if (modalAction === 'new_file' || modalAction === 'new_folder') {
        const newPath = targetPath ? `${targetPath}/${inputValue}` : inputValue;
        if (modalAction === 'new_folder') {
          // Folder is implicit, we create a dummy file to hold the folder if needed,
          // or just create a file like newPath + "/.keep"
          await workspaceService.updateFiles(taskId, [{ path: `${newPath}/.keep`, content: '' }]);
        } else {
          await workspaceService.updateFiles(taskId, [{ path: newPath, content: '' }]);
          openFile(newPath, '');
        }
      } else if (modalAction === 'rename') {
        const parent = getParentPath(targetPath);
        const newPath = parent ? `${parent}/${inputValue}` : inputValue;
        const content = workspaceService.readFile(targetPath);

        await workspaceService.updateFiles(taskId, [{ path: newPath, content }]);
        await workspaceService.deleteFile(taskId, targetPath);
        closeFile(targetPath);
        openFile(newPath, content);
      }
      // Reload from backend to get full sync
      await workspaceService.loadWorkspace(taskId);
      fetchTree();
    } catch (_err) {
      message.error(`Failed to ${modalAction ?? 'action'}`);
    }
    setIsModalOpen(false);
    setInputValue('');
  };

  const confirmDelete = (path: string) => {
    Modal.confirm({
      title: 'Delete File',
      content: `Are you sure you want to delete ${path}?`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        if (!taskId) return;
        try {
          await workspaceService.deleteFile(taskId, path);
          closeFile(path);
          await workspaceService.loadWorkspace(taskId);
          fetchTree();
          message.success('Deleted');
        } catch (_err) {
          message.error('Failed to delete');
        }
      },
    });
  };

  const titleRender = (node: DataNode) => {
    const isLeaf = node.isLeaf;
    const metadata = (node as { metadata?: WorkspaceFileDTO }).metadata;
    const isReadonly = metadata?.readonly === true || metadata?.locked === true;

    const items: MenuProps['items'] = [];
    if (!isLeaf) {
      items.push({ key: 'new_file', label: 'New File' });
      items.push({ key: 'new_folder', label: 'New Folder' });
    }
    if (!isReadonly) {
      items.push({ key: 'rename', label: 'Rename' });
      items.push({ key: 'delete', label: 'Delete', danger: true });
    }

    const titleStr = node.title as string;
    const index = titleStr.indexOf(searchValue);
    const beforeStr = titleStr.substring(0, index);
    const afterStr = titleStr.substring(index + searchValue.length);
    const titleContent =
      index > -1 ? (
        <span>
          {beforeStr}
          <span className="bg-yellow-200">{searchValue}</span>
          {afterStr}
        </span>
      ) : (
        <span>{titleStr}</span>
      );

    if (items.length === 0) return <span>{titleContent}</span>;

    return (
      <Dropdown
        menu={{
          items,
          onClick: ({ key, domEvent }) => {
            domEvent.stopPropagation();
            if (key === 'delete') {
              confirmDelete(node.key as string);
            } else {
              setModalAction(key as 'new_file' | 'new_folder' | 'rename' | null);
              setTargetPath(node.key as string);
              setInputValue(key === 'rename' ? (node.title as string) : '');
              setIsModalOpen(true);
            }
          },
        }}
        trigger={['contextMenu']}
      >
        <span className="w-full inline-block">{titleContent}</span>
      </Dropdown>
    );
  };

  const getParentKey = (key: React.Key, tree: DataNode[]): React.Key | undefined => {
    let parentKey: React.Key | undefined;
    for (const node of tree) {
      if (node.children) {
        if (node.children.some((item) => item.key === key)) {
          parentKey = node.key;
        } else if (getParentKey(key, node.children)) {
          parentKey = getParentKey(key, node.children);
        }
      }
    }
    return parentKey;
  };

  const dataList = React.useMemo(() => {
    const list: { key: React.Key; title: string }[] = [];
    const generateList = (data: DataNode[]) => {
      for (const node of data) {
        const { key } = node;
        list.push({ key, title: node.title as string });
        if (node.children) {
          generateList(node.children);
        }
      }
    };
    generateList(treeData);
    return list;
  }, [treeData]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const newExpandedKeys = dataList
      .map((item) => {
        if (item.title.includes(value)) {
          return getParentKey(item.key, treeData);
        }
        return null;
      })
      .filter((item, i, self) => item && self.indexOf(item) === i);
    setExpandedKeys(newExpandedKeys as React.Key[]);
    setSearchValue(value);
    setAutoExpandParent(true);
  };

  return (
    <div className="h-full bg-gray-50 flex flex-col border-r border-gray-200" role="region" aria-label="Workspace file explorer">
      <div className="px-4 py-2 font-bold text-sm text-gray-600 bg-gray-100 border-b border-gray-200 flex justify-between items-center">
        <span>EXPLORER</span>
      </div>
      <RecentFiles />
      <div className="p-2 border-b border-gray-200">
        <Search
          style={{ marginBottom: 8 }}
          placeholder="Search files"
          onChange={onChange}
          aria-label="Search workspace files"
        />
      </div>
      <div className="p-2 flex-1 overflow-y-auto">
        {treeData.length > 0 ? (
          <Tree
            showIcon
            onExpand={(newExpandedKeys) => {
              setExpandedKeys(newExpandedKeys);
              setAutoExpandParent(false);
            }}
            expandedKeys={expandedKeys}
            autoExpandParent={autoExpandParent}
            treeData={treeData}
            onSelect={onSelect}
            titleRender={titleRender}
            selectedKeys={activeFile ? [activeFile] : []}
          />
        ) : (
          <div className="text-gray-400 text-center mt-4">No files</div>
        )}
      </div>

      <Modal
        title={
          modalAction === 'new_file'
            ? 'Create File'
            : modalAction === 'new_folder'
              ? 'Create Folder'
              : 'Rename'
        }
        open={isModalOpen}
        onOk={() => { void handleModalSubmit(); }}
        onCancel={() => { setIsModalOpen(false); }}
        okText="Confirm"
      >
        <Input
          autoFocus
          value={inputValue}
          aria-label={modalAction === 'rename' ? 'Rename item' : modalAction === 'new_folder' ? 'New folder name' : 'New file name'}
          onChange={(e) => { setInputValue(e.target.value); }}
          onPressEnter={() => { void handleModalSubmit(); }}
          placeholder={
            modalAction === 'rename'
              ? 'Enter new name'
              : modalAction === 'new_folder'
                ? 'Enter folder name'
                : 'Enter file name'
          }
        />
      </Modal>
    </div>
  );
});
