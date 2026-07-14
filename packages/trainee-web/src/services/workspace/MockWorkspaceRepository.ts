import { FileNode, WorkspaceRepository } from './WorkspaceRepository';

export class MockWorkspaceRepository implements WorkspaceRepository {
  private files = new Map<string, string>();
  private fileTree: FileNode[] = [];

  constructor() {
    this.initMockData();
  }

  private initMockData() {
    this.files.set('/src/index.ts', 'console.log("Hello World");\n');
    this.files.set('/src/utils.ts', 'export const add = (a: number, b: number) => a + b;\n');
    this.files.set('/package.json', '{\n  "name": "mock-project",\n  "version": "1.0.0"\n}\n');
    this.files.set('/README.md', '# Mock Project\nThis is a mock project for testing.');

    this.fileTree = [
      {
        path: '/src',
        name: 'src',
        type: 'directory',
        children: [
          { path: '/src/index.ts', name: 'index.ts', type: 'file' },
          { path: '/src/utils.ts', name: 'utils.ts', type: 'file' },
        ],
      },
      { path: '/package.json', name: 'package.json', type: 'file' },
      { path: '/README.md', name: 'README.md', type: 'file' },
    ];
  }

  async loadWorkspace(taskId: string): Promise<void> {
    console.log(`[MockWorkspaceRepository] Loading workspace for task ${taskId}...`);
    return new Promise((resolve) => setTimeout(resolve, 500));
  }

  async getFileTree(): Promise<FileNode[]> {
    return new Promise((resolve) =>
      setTimeout(() => {
        resolve(this.fileTree);
      }, 100),
    );
  }

  async readFile(path: string): Promise<string> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        const content = this.files.get(path);
        if (content !== undefined) {
          resolve(content);
        } else {
          reject(new Error(`File not found: ${path}`));
        }
      }, 100);
    });
  }

  async writeFile(path: string, content: string): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.files.set(path, content);
        console.log(`[MockWorkspaceRepository] Saved file ${path}`);
        resolve();
      }, 100);
    });
  }

  getAllFiles(): Promise<{ path: string; content: string }[]> {
    const allFiles = [];
    for (const [path, content] of this.files.entries()) {
      allFiles.push({ path, content });
    }
    return Promise.resolve(allFiles);
  }
}
