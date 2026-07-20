import React from 'react';
import type { DataNode } from 'antd/es/tree';
import { WorkspaceFileDTO } from '@lg-agent/contracts';
import { FileOutlined, FolderOutlined } from '@ant-design/icons';

export class WorkspaceTreeService {
  /**
   * Builds an Antd Tree structure from a flat list of file paths.
   * Filters out hidden files and honors nested directories implicitly.
   */
  public static buildTree(files: WorkspaceFileDTO[]): DataNode[] {
    const rootNodes: DataNode[] = [];
    const nodeMap: Record<string, DataNode> = {};

    // Filter hidden files
    const visibleFiles = files.filter((f) => !f.hidden);

    // Ensure all implicit folders exist in nodeMap
    visibleFiles.forEach((file) => {
      const parts = file.path.split('/');
      let currentPath = '';

      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i] || '';
        const isFirst = i === 0;
        currentPath = isFirst ? part : `${currentPath}/${part}`;

        if (!nodeMap[currentPath]) {
          const folderNode: DataNode = {
            title: part,
            key: currentPath,
            isLeaf: false,
            children: [],
            icon: React.createElement(FolderOutlined),
          };
          nodeMap[currentPath] = folderNode;

          if (isFirst) {
            rootNodes.push(folderNode);
          } else {
            const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
            if (nodeMap[parentPath] && nodeMap[parentPath].children) {
              nodeMap[parentPath].children!.push(folderNode);
            }
          }
        }
      }
    });

    // Add files to nodeMap
    visibleFiles.forEach((file) => {
      const parts = file.path.split('/');
      const fileName = parts[parts.length - 1];
      const isRootFile = parts.length === 1;

      const fileNode: DataNode & { metadata: WorkspaceFileDTO } = {
        title: fileName,
        key: file.path,
        isLeaf: true,
        icon: React.createElement(FileOutlined),
        metadata: file,
      };

      if (isRootFile) {
        rootNodes.push(fileNode);
      } else {
        const parentPath = file.path.substring(0, file.path.lastIndexOf('/'));
        if (nodeMap[parentPath] && nodeMap[parentPath].children) {
          nodeMap[parentPath].children!.push(fileNode);
        }
      }
    });

    // Sort: Folders first, then files, both alphabetically
    const sortNodes = (nodes: DataNode[]) => {
      nodes.sort((a, b) => {
        if (a.isLeaf === b.isLeaf) {
          return (a.title as string).localeCompare(b.title as string);
        }
        return a.isLeaf ? 1 : -1;
      });
      nodes.forEach((n) => {
        if (n.children) {
          sortNodes(n.children);
        }
      });
    };

    sortNodes(rootNodes);
    return rootNodes;
  }
}
