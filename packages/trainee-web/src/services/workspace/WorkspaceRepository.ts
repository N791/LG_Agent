export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  children?: FileNode[];
}

export interface WorkspaceRepository {
  /**
   * Initializes or loads the workspace for a given task
   */
  loadWorkspace(taskId: string): Promise<void>;

  /**
   * Gets the file tree structure
   */
  getFileTree(): Promise<FileNode[]>;

  /**
   * Reads a file's content
   */
  readFile(path: string): Promise<string>;

  /**
   * Writes content to a file
   */
  writeFile(path: string, content: string): Promise<void>;

  /**
   * Gets all files
   */
  getAllFiles(): Promise<{ path: string; content: string }[]>;
}
