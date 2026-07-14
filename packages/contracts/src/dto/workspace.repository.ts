export interface WorkspaceRepository {
  /**
   * Loads a workspace for a specific task and user
   */
  getWorkspace(
    taskId: string,
    userId: string,
  ): Promise<{
    fileContents: Record<string, string>;
    entry?: string;
    metadata?: Record<string, unknown>;
  }>;
}
