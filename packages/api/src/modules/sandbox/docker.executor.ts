import { Injectable, Logger } from '@nestjs/common';
import { IExecutor } from './interfaces/executor.interface';
import { WorkspaceService } from './workspace.service';
import { spawn } from 'child_process';
import {
  ExecutionEventDTO,
  ExecutionEventType,
  WorkspaceDTO,
  SandboxAction,
} from '@lg-agent/contracts';
import { NodeRuntimeProfile } from './node-runtime.profile';
import { ExecutionManager } from './execution.manager';

@Injectable()
export class DockerExecutor implements IExecutor {
  private readonly logger = new Logger(DockerExecutor.name);
  private readonly profile = new NodeRuntimeProfile();

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly executionManager: ExecutionManager,
  ) {}

  async *execute(
    taskId: string,
    userId: string,
    workspaceDto: WorkspaceDTO,
    config: {
      testScript?: string | null;
      env?: { node?: boolean } | null;
      action?: SandboxAction;
      executionId?: string;
    },
  ): AsyncGenerator<ExecutionEventDTO, void, unknown> {
    const workspace = this.workspaceService.createWorkspace(userId, taskId);
    const executionId = config.executionId ?? Date.now().toString();

    try {
      this.workspaceService.writeFiles(workspace, workspaceDto);

      yield {
        type: ExecutionEventType.RUNNING,
        timestamp: new Date().toISOString(),
        message: `Sandbox environment starting (Action: ${config.action ?? 'run'})...`,
      };

      const image = config.env?.node ? 'node:20-alpine' : 'node:20-alpine';
      const executionTimeoutMs = 30000;
      const hostPath = workspace.path;

      let containerCmd = '';
      switch (config.action) {
        case 'build':
          containerCmd = this.profile.getBuildCmd();
          break;
        case 'lint':
          containerCmd = this.profile.getLintCmd();
          break;
        case 'test':
          containerCmd = this.profile.getTestCmd();
          break;
        case 'run':
        default: {
          let targetScript = config.testScript ? 'test.js' : workspaceDto.workspace.entry;
          if (!targetScript) {
            const hasTs = workspaceDto.workspace.files.some(
              (f) => f.path === 'index.ts' || f.path.endsWith('.ts'),
            );
            targetScript = hasTs ? 'index.ts' : 'index.js';
          }
          containerCmd = this.profile.getRunCmd(targetScript);
          break;
        }
      }

      const args = [
        'run',
        '--rm',
        '-v',
        `${hostPath}:/app`,
        '-w',
        '/app',
        '--memory=256m',
        '--cpus=0.5',
        image,
        'sh',
        '-c',
        containerCmd,
      ];

      this.logger.log(`Executing Docker Sandbox for Workspace: ${workspace.workspaceId}`);

      let exitCode: number | null = null;
      let isTimeout = false;

      const child = spawn('docker', args);
      this.executionManager.register(executionId, child);

      const timer = setTimeout(() => {
        isTimeout = true;
        child.kill('SIGKILL');
      }, executionTimeoutMs);

      // Async queue to yield events from data callbacks
      const queue: ExecutionEventDTO[] = [];
      let resolveNext: (() => void) | null = null;
      let isDone = false;
      let processError: Error | null = null;

      const pushEvent = (event: ExecutionEventDTO) => {
        queue.push(event);
        if (resolveNext) {
          resolveNext();
          resolveNext = null;
        }
      };

      child.stdout.on('data', (data: Buffer) => {
        const text = data.toString();
        pushEvent({
          type: ExecutionEventType.LOG,
          data: { stream: 'stdout', text },
          timestamp: new Date().toISOString(),
        });
      });

      child.stderr.on('data', (data: Buffer) => {
        const text = data.toString();
        pushEvent({
          type: ExecutionEventType.LOG,
          data: { stream: 'stderr', text },
          timestamp: new Date().toISOString(),
        });
      });

      child.on('error', (err) => {
        clearTimeout(timer);
        processError = err;
        isDone = true;
        if (resolveNext) resolveNext();
      });

      child.on('close', (code) => {
        clearTimeout(timer);
        exitCode = code;
        isDone = true;
        if (resolveNext) resolveNext();
      });

      // Yield events as they come in
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      while (!isDone || queue.length > 0) {
        if (queue.length > 0) {
          const item = queue.shift();
          if (item) yield item;
        } else {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (!isDone) {
            await new Promise<void>((resolve) => {
              resolveNext = resolve;
            });
          }
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (processError) {
        throw new Error((processError as Error).message);
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (isTimeout) {
        throw new Error(`Execution timed out after ${String(executionTimeoutMs)}ms.`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const passed = exitCode === 0;

      yield {
        type: passed ? ExecutionEventType.SUCCESS : ExecutionEventType.FAILED,
        data: {
          passed,
          score: passed ? 100 : 0,
          report: { exitCode, message: passed ? 'All tests passed' : 'Execution failed' },
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      this.logger.error(
        `Docker execution failed for ${workspace.workspaceId}: ${(error as Error).message}`,
      );
      yield {
        type: ExecutionEventType.ERROR,
        message: `[Sandbox Engine Error]\n${(error as Error).message}`,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.executionManager.unregister(executionId);
      this.workspaceService.cleanupWorkspace(workspace);
      yield {
        type: ExecutionEventType.COMPLETE,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
