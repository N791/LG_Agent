import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

export interface WorkspaceMetadata {
  workspaceId: string;
  path: string;
}

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);
  
  /**
   * Creates an isolated workspace directory in the OS temp folder.
   */
  createWorkspace(userId: string, taskId: string): WorkspaceMetadata {
    const workspaceId = `ws_${userId}_${taskId}_${Date.now().toString()}_${randomUUID().split('-')[0] ?? ''}`;
    const workspacePath = path.join(os.tmpdir(), 'lg-agent-workspaces', workspaceId);
    
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }
    
    this.logger.debug(`Created workspace at ${workspacePath}`);
    return { workspaceId, path: workspacePath };
  }

  /**
   * Writes the necessary source code files into the workspace.
   */
  writeFiles(workspace: WorkspaceMetadata, code: string, config: { testScript?: string }): void {
    const indexFile = path.join(workspace.path, 'index.js');
    fs.writeFileSync(indexFile, code);

    if (config.testScript) {
      const testFile = path.join(workspace.path, 'test.js');
      fs.writeFileSync(testFile, config.testScript);
    }
    
    // MVP logic for package.json to trigger npm install inside docker
    // In future this will be replaced by actual template cloning
    const packageJsonFile = path.join(workspace.path, 'package.json');
    if (!fs.existsSync(packageJsonFile)) {
      fs.writeFileSync(packageJsonFile, JSON.stringify({
        name: `sandbox-${workspace.workspaceId}`,
        version: "1.0.0",
        description: "LG_Agent execution workspace"
      }, null, 2));
    }
  }

  /**
   * Cleans up the workspace directory after execution.
   */
  cleanupWorkspace(workspace: WorkspaceMetadata): void {
    try {
      if (fs.existsSync(workspace.path)) {
        fs.rmSync(workspace.path, { recursive: true, force: true });
        this.logger.debug(`Cleaned up workspace at ${workspace.path}`);
      }
    } catch (error: unknown) {
      this.logger.error(`Failed to cleanup workspace ${workspace.path}: ${(error as Error).message}`);
    }
  }
}
