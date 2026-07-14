import { Injectable, Logger } from '@nestjs/common';
import { IExecutor } from './interfaces/executor.interface';
import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import { ExecutionEventDTO, ExecutionEventType, WorkspaceDTO } from '@lg-agent/contracts';

const execPromise = util.promisify(exec);

@Injectable()
export class LocalExecutor implements IExecutor {
  private readonly logger = new Logger(LocalExecutor.name);

  async *execute(
    taskId: string,
    userId: string,
    workspaceDto: WorkspaceDTO,
    config: { testScript?: string; env?: { node?: boolean } },
  ): AsyncGenerator<ExecutionEventDTO, void, unknown> {
    const workspaceId = `ws_${userId}_${taskId}_${Date.now().toString()}`;
    const workspacePath = path.join(process.cwd(), 'temp_workspaces', workspaceId);

    try {
      // 1. Create Workspace
      fs.mkdirSync(workspacePath, { recursive: true });

      // 2. Write User Code
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (workspaceDto.workspace.files) {
        for (const file of workspaceDto.workspace.files) {
          const filePath = path.join(workspacePath, file.path);
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

      yield {
        type: ExecutionEventType.RUNNING,
        timestamp: new Date().toISOString(),
        message: 'Sandbox environment starting...',
      };

      // 3. Write Test Code (if any provided in config)
      let testFile = '';
      if (config.testScript) {
        testFile = path.join(workspacePath, 'test.js');
        fs.writeFileSync(testFile, config.testScript);
      }

      // 4. Execute via child_process
      let cmd = `node index.js`;
      if (testFile) {
        cmd = `node test.js`;
      } else if (workspaceDto.workspace.entry) {
        cmd = `node ${workspaceDto.workspace.entry}`;
      }

      this.logger.log(`Execution starting in ${workspaceId}`);

      const { stdout, stderr } = await execPromise(cmd, {
        cwd: workspacePath,
        timeout: 5000,
      });

      this.logger.log(`Execution success in ${workspaceId}`);

      if (stdout) {
        yield {
          type: ExecutionEventType.LOG,
          data: { stream: 'stdout', text: stdout },
          timestamp: new Date().toISOString(),
        };
      }

      if (stderr) {
        yield {
          type: ExecutionEventType.LOG,
          data: { stream: 'stderr', text: stderr },
          timestamp: new Date().toISOString(),
        };
      }

      yield {
        type: ExecutionEventType.SUCCESS,
        data: { passed: true, score: 100, report: { message: 'All tests passed' } },
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      const execError = error as {
        stdout?: Buffer | string;
        stderr?: Buffer | string;
        message: string;
      };
      this.logger.error(`Execution failed in ${workspaceId}`, execError.message);

      if (execError.stdout) {
        yield {
          type: ExecutionEventType.LOG,
          data: { stream: 'stdout', text: String(execError.stdout) },
          timestamp: new Date().toISOString(),
        };
      }

      if (execError.stderr) {
        yield {
          type: ExecutionEventType.LOG,
          data: { stream: 'stderr', text: String(execError.stderr) },
          timestamp: new Date().toISOString(),
        };
      }

      yield {
        type: ExecutionEventType.FAILED,
        data: { passed: false, score: 0, report: { error: execError.message } },
        timestamp: new Date().toISOString(),
      };
    } finally {
      // Clean up workspace
      if (fs.existsSync(workspacePath)) {
        fs.rmSync(workspacePath, { recursive: true, force: true });
      }
      yield {
        type: ExecutionEventType.COMPLETE,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
