import request from '../../utils/request';
import { WorkspaceDTO, WorkspaceFileDTO, WorkspaceVersionDTO } from '@lg-agent/contracts';
import { FileNode } from './WorkspaceRepository';

export class WorkspaceService {
  private static instance: WorkspaceService | undefined;
  private currentWorkspace: WorkspaceDTO | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static getInstance(): WorkspaceService {
    WorkspaceService.instance ??= new WorkspaceService();
    return WorkspaceService.instance;
  }

  /**
   * Initialize or resume workspace from backend
   */
  async loadWorkspace(taskId: string): Promise<WorkspaceDTO> {
    try {
      const response = await request.get<{ data?: WorkspaceDTO } | WorkspaceDTO>(
        `/workspaces/${taskId}`,
      );
      this.currentWorkspace =
        (response as unknown as { data?: WorkspaceDTO })?.data ??
        (response as unknown as WorkspaceDTO);
      return this.currentWorkspace;
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 404 || error.response?.status === 400) {
        // Not initialized yet, initialize it
        const initResponse = await request.post<{ data?: WorkspaceDTO } | WorkspaceDTO>(
          `/workspaces/init`,
          { taskId },
        );
        this.currentWorkspace =
          (initResponse as unknown as { data?: WorkspaceDTO })?.data ??
          (initResponse as unknown as WorkspaceDTO);
        return this.currentWorkspace;
      }
      throw err;
    }
  }

  async updateFiles(
    taskId: string,
    files: Pick<WorkspaceFileDTO, 'path' | 'content'>[],
  ): Promise<void> {
    const response = await request.put<{ data?: WorkspaceDTO } | WorkspaceDTO>(
      `/workspaces/${taskId}/files`,
      { files },
    );
    this.currentWorkspace =
      (response as unknown as { data?: WorkspaceDTO })?.data ??
      (response as unknown as WorkspaceDTO);
  }

  async deleteFile(taskId: string, path: string): Promise<void> {
    const response = await request.delete<{ data?: WorkspaceDTO } | WorkspaceDTO>(
      `/workspaces/${taskId}/files?path=${encodeURIComponent(path)}`
    );
    this.currentWorkspace =
      (response as unknown as { data?: WorkspaceDTO })?.data ??
      (response as unknown as WorkspaceDTO);
  }

  async createVersion(taskId: string, trigger: 'RUN' | 'SUBMIT' | 'MANUAL'): Promise<void> {
    await request.post(`/workspaces/${taskId}/versions`, { trigger });
  }

  async getVersions(taskId: string): Promise<WorkspaceVersionDTO[]> {
    const response = await request.get<{ data?: WorkspaceVersionDTO[] } | WorkspaceVersionDTO[]>(
      `/workspaces/${taskId}/versions`
    );
    return (response as unknown as { data?: WorkspaceVersionDTO[] })?.data ?? 
           (response as unknown as WorkspaceVersionDTO[]);
  }

  async restoreVersion(taskId: string, versionId: string): Promise<WorkspaceDTO> {
    const response = await request.post<{ data?: WorkspaceDTO } | WorkspaceDTO>(
      `/workspaces/${taskId}/versions/${versionId}/restore`
    );
    this.currentWorkspace = (response as unknown as { data?: WorkspaceDTO })?.data ?? 
                            (response as unknown as WorkspaceDTO);
    return this.currentWorkspace;
  }

  getFileTree(): FileNode[] {
    if (!this.currentWorkspace) return [];

    const nodes: FileNode[] = [];
    const files = this.currentWorkspace.workspace.files;

    // Simple flat-to-tree conversion for demo purposes
    files.forEach((f) => {
      const parts = f.path.split('/');
      if (parts.length === 1) {
        nodes.push({ key: f.path, name: f.path, type: 'file', path: f.path } as FileNode);
      } else {
        // Grouping logic would go here, omitting for simplicity since mock had a flat list mostly
        nodes.push({
          key: f.path,
          name: parts[parts.length - 1],
          type: 'file',
          path: f.path,
        } as FileNode);
      }
    });

    return nodes;
  }

  readFile(path: string): string {
    if (!this.currentWorkspace) return '';
    const file = this.currentWorkspace.workspace.files.find((f) => f.path === path);
    return file?.content ?? '';
  }

  writeFile(path: string, content: string): void {
    if (!this.currentWorkspace) return;
    const file = this.currentWorkspace.workspace.files.find((f) => f.path === path);
    if (file) {
      file.content = content;
    }
  }
}

export const workspaceService = WorkspaceService.getInstance();
