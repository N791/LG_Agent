import { Injectable, Logger } from '@nestjs/common';
import { IExecutor } from './interfaces/executor.interface';
import { execFile } from 'child_process';
import * as util from 'util';
import {
  ExecutionEventDTO,
  ExecutionEventType,
  SandboxAction,
  WorkspaceDTO,
} from '@lg-agent/contracts';
import { ExecutionWorkspaceService } from './execution-workspace.service';
import type { RuntimeEnvironmentDTO } from '@lg-agent/contracts';
import { RuntimeProfileRegistry } from './runtime-profile.registry';

const execFilePromise = util.promisify(execFile);

@Injectable()
export class LocalExecutor implements IExecutor {
  private readonly logger = new Logger(LocalExecutor.name);

  constructor(
    private readonly executionWorkspaceService: ExecutionWorkspaceService,
    private readonly runtimeProfiles: RuntimeProfileRegistry,
  ) {}

  async *execute(
    _taskId: string,
    _userId: string,
    workspaceDto: WorkspaceDTO,
    config: {
      testScript?: string | null;
      env?: { node?: boolean } | null;
      action?: SandboxAction;
      executionId?: string;
      runtime?: Partial<RuntimeEnvironmentDTO> | null;
      queuedAtMs?: number;
    },
  ): AsyncGenerator<ExecutionEventDTO, void, unknown> {
    const executionWorkspace = this.executionWorkspaceService.createExecutionWorkspace();

    try {
      this.executionWorkspaceService.stageAuthoringWorkspace(executionWorkspace, workspaceDto);
      if (config.testScript) {
        this.executionWorkspaceService.writeFile(executionWorkspace, 'test.js', config.testScript);
      }

      yield {
        type: ExecutionEventType.RUNNING,
        timestamp: new Date().toISOString(),
        message: 'Sandbox environment starting...',
      };

      const action = config.action ?? 'run';
      const entryPoint = this.executionWorkspaceService.validateEntryPoint(
        config.testScript
          ? 'test.js'
          : (config.runtime?.entry ?? workspaceDto.workspace.entry ?? 'index.js'),
      );
      const resolved = this.runtimeProfiles.resolve(
        config.runtime ?? workspaceDto.workspace.runtime,
        action,
        entryPoint,
      );
      this.executionWorkspaceService.assertActionInputs(workspaceDto, action, resolved.environment);

      this.logger.warn(
        `Local executor is for development/test only; starting ${executionWorkspace.executionWorkspaceId}`,
      );

      const { stdout, stderr } = await execFilePromise(
        resolved.command.executable,
        resolved.command.args,
        {
          cwd: resolved.command.workdir
            ? `${executionWorkspace.path}/${resolved.command.workdir}`
            : executionWorkspace.path,
          env: { ...process.env, ...resolved.command.env },
          timeout: 5000,
        },
      );

      this.logger.log(`Execution success in ${executionWorkspace.executionWorkspaceId}`);

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
      this.logger.error(
        `Execution failed in ${executionWorkspace.executionWorkspaceId}`,
        execError.message,
      );

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
      this.executionWorkspaceService.cleanupExecutionWorkspace(executionWorkspace);
      yield {
        type: ExecutionEventType.COMPLETE,
        timestamp: new Date().toISOString(),
      };
    }
  }
}
