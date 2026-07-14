import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

import { WorkspaceDTO } from '@lg-agent/contracts';

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
  writeFiles(workspace: WorkspaceMetadata, workspaceDto: WorkspaceDTO): void {
    // Write all files from WorkspaceDTO
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (workspaceDto.workspace.files) {
      for (const file of workspaceDto.workspace.files) {
        const filePath = path.join(workspace.path, file.path);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(
          filePath,
          file.content,
          (file.encoding as BufferEncoding | undefined) ?? 'utf-8',
        );
      }
    }

    // MVP logic for package.json to trigger npm install inside docker
    const packageJsonFile = path.join(workspace.path, 'package.json');
    if (!fs.existsSync(packageJsonFile)) {
      fs.writeFileSync(
        packageJsonFile,
        JSON.stringify(
          {
            name: `sandbox-${workspace.workspaceId}`,
            version: '1.0.0',
            description: 'LG_Agent execution workspace',
          },
          null,
          2,
        ),
      );
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
      this.logger.error(
        `Failed to cleanup workspace ${workspace.path}: ${(error as Error).message}`,
      );
    }
  }
}
