import { Injectable, Logger } from '@nestjs/common';
import { IExecutor, ExecutionResult } from './interfaces/executor.interface';
import { WorkspaceService } from './workspace.service';
import { spawn } from 'child_process';
import * as os from 'os';


@Injectable()
export class DockerExecutor implements IExecutor {
  private readonly logger = new Logger(DockerExecutor.name);

  constructor(private readonly workspaceService: WorkspaceService) {}

  async execute(taskId: string, userId: string, code: string, config: { testScript?: string, env?: { node?: boolean } }): Promise<ExecutionResult> {
    const workspace = this.workspaceService.createWorkspace(userId, taskId);
    
    try {
      this.workspaceService.writeFiles(workspace, code, config);
      
      const image = config.env?.node ? 'node:20-alpine' : 'node:20-alpine'; // Hardcode node:20-alpine for MVP
      const executionTimeoutMs = 30000; // 30 seconds

      // Normalize path for Docker volume mounting. In Windows WSL or normal Windows, Docker handles C:\... or similar well.
      // But using POSIX style paths is safer for Linux environments.
      const hostPath = workspace.path;
      if (os.platform() === 'win32') {
         // Windows docker desktop usually requires paths to be correctly passed.
         // Let's rely on standard path format. Docker handles it.
         // However, WSL docker might have issues. We'll stick to standard for now.
      }
      
      const targetScript = config.testScript ? 'test.js' : 'index.js';
      const containerCmd = `npm install --no-audit --no-fund && node ${targetScript}`;

      const args = [
        'run',
        '--rm',
        '-v', `${hostPath}:/app`,
        '-w', '/app',
        '--memory=256m',
        '--cpus=0.5',
        image,
        'sh', '-c', containerCmd
      ];

      this.logger.log(`Executing Docker Sandbox for Workspace: ${workspace.workspaceId}`);
      
      const { stdout, stderr, exitCode } = await this.spawnCommand('docker', args, executionTimeoutMs);
      
      const logs = stdout + (stderr ? `\n[STDERR]\n${stderr}` : '');
      const passed = exitCode === 0;

      return {
        passed,
        score: passed ? 100 : 0,
        logs: logs.trim(),
        report: { exitCode, message: passed ? 'All tests passed' : 'Execution failed' }
      };

    } catch (error: unknown) {
      this.logger.error(`Docker execution failed for ${workspace.workspaceId}: ${(error as Error).message}`);
      return {
        passed: false,
        score: 0,
        logs: `[Sandbox Engine Error]\n${(error as Error).message}`,
        report: { error: (error as Error).message }
      };
    } finally {
      // Always cleanup workspace to prevent leak
      this.workspaceService.cleanupWorkspace(workspace);
    }
  }

  private spawnCommand(command: string, args: string[], timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
    return new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';

      const child = spawn(command, args);
      let isTimeout = false;

      const timer = setTimeout(() => {
        isTimeout = true;
        child.kill('SIGKILL');
      }, timeoutMs);

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        if (isTimeout) {
          reject(new Error(`Execution timed out after ${timeoutMs.toString()}ms.`));
        } else {
          resolve({ stdout, stderr, exitCode: code });
        }
      });
    });
  }
}
