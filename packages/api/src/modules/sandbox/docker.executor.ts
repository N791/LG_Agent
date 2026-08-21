import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { IExecutor } from './interfaces/executor.interface';
import { ExecutionWorkspaceService } from './execution-workspace.service';
import { execFileSync, spawn } from 'child_process';
import {
  ExecutionEventDTO,
  ExecutionEventType,
  WorkspaceDTO,
  SandboxAction,
  RuntimeEnvironmentDTO,
} from '@lg-agent/contracts';
import { ExecutionManager } from './execution.manager';
import { SANDBOX_EXECUTION_TIMEOUT_MS } from './sandbox.tokens';
import { SandboxSecurityConfig } from './sandbox-security.config';
import { RuntimeProfileRegistry } from './runtime-profile.registry';
import { RuntimeMetricsService } from './runtime-metrics.service';
import { createHash } from 'crypto';

@Injectable()
export class DockerExecutor implements IExecutor {
  private readonly logger = new Logger(DockerExecutor.name);

  constructor(
    private readonly executionWorkspaceService: ExecutionWorkspaceService,
    private readonly executionManager: ExecutionManager,
    private readonly runtimeProfiles: RuntimeProfileRegistry,
    @Optional()
    @Inject(SANDBOX_EXECUTION_TIMEOUT_MS)
    private readonly executionTimeoutMs = 30000,
    @Optional()
    private readonly securityConfig: SandboxSecurityConfig = {
      policy: {
        image:
          'node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293',
        pidsLimit: 128,
        memoryLimit: '256m',
        cpuLimit: 0.5,
      },
    } as SandboxSecurityConfig,
    @Optional()
    private readonly runtimeMetrics?: RuntimeMetricsService,
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
      organizationId?: string;
      runtime?: Partial<RuntimeEnvironmentDTO> | null;
      queuedAtMs?: number;
    },
  ): AsyncGenerator<ExecutionEventDTO, void, unknown> {
    const executionWorkspace = this.executionWorkspaceService.createExecutionWorkspace();
    const executionId = config.executionId ?? Date.now().toString();
    const organizationId = config.organizationId ?? _userId;
    this.executionManager.acquire(executionId, _userId, organizationId, _taskId, config.action);

    try {
      this.executionWorkspaceService.stageAuthoringWorkspace(executionWorkspace, workspaceDto);
      if (config.testScript) {
        this.executionWorkspaceService.writeFile(executionWorkspace, 'test.js', config.testScript);
      }

      yield {
        type: ExecutionEventType.RUNNING,
        timestamp: new Date().toISOString(),
        message: `Sandbox environment starting (Action: ${config.action ?? 'run'})...`,
      };

      const hostPath = executionWorkspace.path;
      const action = config.action ?? 'run';
      let targetScript = config.testScript
        ? 'test.js'
        : (config.runtime?.entry ??
          workspaceDto.workspace.runtime?.entry ??
          workspaceDto.workspace.entry);
      if (!targetScript) {
        const hasTs = workspaceDto.workspace.files.some(
          (f) => f.path === 'index.ts' || f.path.endsWith('.ts'),
        );
        targetScript = hasTs ? 'index.ts' : 'index.js';
      }
      targetScript = this.executionWorkspaceService.validateEntryPoint(targetScript);
      const resolved = this.runtimeProfiles.resolve(
        config.runtime ?? workspaceDto.workspace.runtime,
        action,
        targetScript,
      );
      this.executionWorkspaceService.assertActionInputs(workspaceDto, action, resolved.environment);
      const executionStartedAt = Date.now();
      const cache = cacheMount(
        resolved.profile.language,
        resolved.environment.version,
        organizationId,
        workspaceDto,
      );
      this.runtimeMetrics?.recordCache(
        {
          language: resolved.profile.language,
          version: resolved.environment.version,
        },
        dockerVolumeExists(cache.name),
      );

      const args = [
        'run',
        '--rm',
        '--init',
        '--network=none',
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges',
        `--pids-limit=${String(this.securityConfig.policy.pidsLimit)}`,
        '--user=1000:1000',
        '--tmpfs=/tmp:rw,noexec,nosuid,size=64m',
        '--env=HOME=/tmp',
        `--env=${cache.envName}=${cache.envValue}`,
        '-v',
        `${hostPath}:/app`,
        '-w',
        resolved.command.workdir ? `/app/${resolved.command.workdir}` : '/app',
        '--mount',
        `type=volume,src=${cache.name},dst=${cache.target}`,
        `--memory=${this.securityConfig.policy.memoryLimit}`,
        `--cpus=${String(this.securityConfig.policy.cpuLimit)}`,
        ...Object.entries(resolved.command.env ?? {}).map(
          ([key, value]) => `--env=${key}=${value}`,
        ),
        resolved.image,
        resolved.command.executable,
        ...resolved.command.args,
      ];

      this.logger.log(
        `Executing Docker Sandbox for execution workspace: ${executionWorkspace.executionWorkspaceId}`,
      );

      let exitCode: number | null = null;
      let isTimeout = false;

      const child = spawn('docker', args);
      let imageReadyRecorded = false;
      const recordImageReady = (): void => {
        if (imageReadyRecorded) return;
        imageReadyRecorded = true;
        this.runtimeMetrics?.observeImagePull(
          {
            language: resolved.profile.language,
            version: resolved.environment.version,
          },
          (Date.now() - executionStartedAt) / 1000,
        );
      };
      this.executionManager.register(executionId, child, _userId, organizationId);

      const timer = setTimeout(() => {
        isTimeout = true;
        child.kill('SIGKILL');
      }, this.executionTimeoutMs);

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
        recordImageReady();
        const text = data.toString();
        pushEvent({
          type: ExecutionEventType.LOG,
          data: { stream: 'stdout', text },
          timestamp: new Date().toISOString(),
        });
      });

      child.stderr.on('data', (data: Buffer) => {
        recordImageReady();
        const text = data.toString();
        pushEvent({
          type: ExecutionEventType.LOG,
          data: { stream: 'stderr', text },
          timestamp: new Date().toISOString(),
        });
      });

      child.on('error', (err) => {
        recordImageReady();
        clearTimeout(timer);
        processError = err;
        isDone = true;
        if (resolveNext) resolveNext();
      });

      child.on('close', (code) => {
        recordImageReady();
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
        throw new Error(`Execution timed out after ${String(this.executionTimeoutMs)}ms.`);
      }

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      const passed = exitCode === 0;
      this.runtimeMetrics?.observeExecution(
        {
          language: resolved.profile.language,
          version: resolved.environment.version,
        },
        action,
        (Date.now() - executionStartedAt) / 1000,
      );
      if (!passed) {
        this.runtimeMetrics?.recordFailure(
          {
            language: resolved.profile.language,
            version: resolved.environment.version,
          },
          // Assigned by the child close callback; static control-flow cannot observe that write.
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          exitCode === 137 ? 'OOM' : `EXIT_${String(exitCode)}`,
        );
      }

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
        `Docker execution failed for ${executionWorkspace.executionWorkspaceId}: ${(error as Error).message}`,
      );
      yield {
        type: ExecutionEventType.ERROR,
        message: `[Sandbox Engine Error]\n${(error as Error).message}`,
        timestamp: new Date().toISOString(),
      };
    } finally {
      this.executionManager.unregister(executionId);
      this.executionWorkspaceService.cleanupExecutionWorkspace(executionWorkspace);
      yield {
        type: ExecutionEventType.COMPLETE,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

function dockerVolumeExists(name: string): boolean {
  try {
    execFileSync('docker', ['volume', 'inspect', name], {
      stdio: 'ignore',
      timeout: 2_000,
    });
    return true;
  } catch {
    return false;
  }
}

function cacheMount(
  language: string,
  version: string,
  organizationId: string,
  workspace: WorkspaceDTO,
): { name: string; target: string; envName: string; envValue: string } {
  const safeOrganization = organizationId.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const settings: Record<string, { target: string; envName: string; locks: string[] }> = {
    node: {
      target: '/cache/npm',
      envName: 'NPM_CONFIG_CACHE',
      locks: ['package-lock.json', 'npm-shrinkwrap.json'],
    },
    java: {
      target: '/cache/maven',
      envName: 'MAVEN_OPTS',
      locks: ['pom.xml', 'gradle.lockfile'],
    },
    python: {
      target: '/cache/pip',
      envName: 'PIP_CACHE_DIR',
      locks: ['uv.lock', 'poetry.lock', 'requirements.txt'],
    },
    go: { target: '/cache/go', envName: 'GOMODCACHE', locks: ['go.sum', 'go.mod'] },
    rust: {
      target: '/cache/cargo',
      envName: 'CARGO_HOME',
      locks: ['Cargo.lock'],
    },
  };
  const setting = settings[language] ?? {
    target: '/cache/dependencies',
    envName: 'XDG_CACHE_HOME',
    locks: [],
  };
  const lockContent = workspace.workspace.files
    .filter((file) => setting.locks.some((lock) => file.path.endsWith(lock)))
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => `${file.path}\0${file.content}`)
    .join('\0');
  const lockHash = createHash('sha256')
    .update(lockContent || 'no-lockfile')
    .digest('hex')
    .slice(0, 16);
  return {
    name: `lg-agent-${safeOrganization}-${language}-${version.replaceAll('.', '_')}-${lockHash}`,
    target: setting.target,
    envName: setting.envName,
    envValue: language === 'java' ? `-Dmaven.repo.local=${setting.target}` : setting.target,
  };
}
