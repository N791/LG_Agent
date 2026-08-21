import { EventEmitter } from 'events';
import { PassThrough } from 'stream';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ExecutionEventType, type WorkspaceDTO } from '@lg-agent/contracts';
import { DockerExecutor } from './docker.executor';
import { LocalExecutor } from './local.executor';
import { ExecutionWorkspaceService } from './execution-workspace.service';
import type { IExecutor } from './interfaces/executor.interface';
import { selectExecutor } from './sandbox.module';
import type { RuntimeProfileRegistry } from './runtime-profile.registry';

jest.mock('child_process', () => ({
  ...jest.requireActual<typeof import('child_process')>('child_process'),
  spawn: jest.fn(),
  execFileSync: jest.fn(() => {
    throw new Error('volume missing');
  }),
}));

const runtimeProfiles = {
  resolve: () => ({
    profile: { language: 'node' },
    environment: { language: 'node', version: '20', entry: 'index.js' },
    command: { executable: 'node', args: ['index.js'] },
    image: 'node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293',
  }),
} as unknown as RuntimeProfileRegistry;

describe('Docker / Local executor contract', () => {
  let testRoot: string;
  let workspaceService: ExecutionWorkspaceService;

  beforeEach(() => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-agent-executor-contract-'));
    workspaceService = new ExecutionWorkspaceService(path.join(testRoot, 'staging'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  it('emits the common lifecycle and cleans staging for LocalExecutor', async () => {
    const executor = new LocalExecutor(workspaceService, runtimeProfiles);
    const events = await collect(executor);

    expect(events.map((event) => event.type)).toEqual([
      ExecutionEventType.RUNNING,
      ExecutionEventType.LOG,
      ExecutionEventType.SUCCESS,
      ExecutionEventType.COMPLETE,
    ]);
    expect(stagingEntries(testRoot)).toEqual([]);
  });

  it('emits the common lifecycle and cleans staging for DockerExecutor', async () => {
    jest.mocked(childProcess.spawn).mockReturnValue(successfulChild() as never);
    const manager = {
      acquire: jest.fn(),
      register: jest.fn(),
      unregister: jest.fn(),
    };
    const executor = new DockerExecutor(workspaceService, manager as never, runtimeProfiles, 1000);
    const events = await collect(executor);

    expect(events.map((event) => event.type)).toEqual([
      ExecutionEventType.RUNNING,
      ExecutionEventType.LOG,
      ExecutionEventType.SUCCESS,
      ExecutionEventType.COMPLETE,
    ]);
    expect(manager.register).toHaveBeenCalledTimes(1);
    expect(manager.unregister).toHaveBeenCalledTimes(1);
    expect(childProcess.spawn).toHaveBeenCalledWith(
      'docker',
      expect.arrayContaining([
        '--network=none',
        '--read-only',
        '--cap-drop=ALL',
        '--security-opt=no-new-privileges',
        '--pids-limit=128',
        '--user=1000:1000',
      ]),
    );
    const dockerArgs = jest.mocked(childProcess.spawn).mock.calls[0]?.[1] as string[];
    expect(dockerArgs).not.toContain('sh');
    expect(dockerArgs).not.toContain('-c');
    expect(dockerArgs.slice(-2)).toEqual(['node', 'index.js']);
    expect(stagingEntries(testRoot)).toEqual([]);
  });

  it('times out Docker execution, unregisters it, and still cleans staging', async () => {
    jest.mocked(childProcess.spawn).mockReturnValue(hangingChild() as never);
    const manager = {
      acquire: jest.fn(),
      register: jest.fn(),
      unregister: jest.fn(),
    };
    const executor = new DockerExecutor(workspaceService, manager as never, runtimeProfiles, 1);
    const events = await collect(executor);

    expect(events.map((event) => event.type)).toEqual([
      ExecutionEventType.RUNNING,
      ExecutionEventType.ERROR,
      ExecutionEventType.COMPLETE,
    ]);
    expect(events[1]?.message).toContain('timed out');
    expect(manager.unregister).toHaveBeenCalledTimes(1);
    expect(stagingEntries(testRoot)).toEqual([]);
  });

  it('turns an OOM exit into the shared failed scoring result', async () => {
    jest.mocked(childProcess.spawn).mockReturnValue(closingChild(137) as never);
    const manager = {
      acquire: jest.fn(),
      register: jest.fn(),
      unregister: jest.fn(),
    };
    const executor = new DockerExecutor(workspaceService, manager as never, runtimeProfiles, 1000);
    const events = await collect(executor);

    expect(events.map((event) => event.type)).toEqual([
      ExecutionEventType.RUNNING,
      ExecutionEventType.FAILED,
      ExecutionEventType.COMPLETE,
    ]);
    const result = events[1]?.data as {
      passed: boolean;
      score: number;
      report: { exitCode: number };
    };
    expect(result.passed).toBe(false);
    expect(result.score).toBe(0);
    expect(result.report.exitCode).toBe(137);
  });
});

describe('executor composition policy', () => {
  const previousNodeEnv = process.env['NODE_ENV'];
  const previousExecutor = process.env['SANDBOX_EXECUTOR'];

  afterEach(() => {
    setEnv('NODE_ENV', previousNodeEnv);
    setEnv('SANDBOX_EXECUTOR', previousExecutor);
  });

  it('forbids LocalExecutor in production instead of silently falling back', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['SANDBOX_EXECUTOR'] = 'local';

    const config = {
      getOrThrow: () => 'local',
      get: () => 'production',
    };
    expect(() =>
      selectExecutor({} as IExecutor as DockerExecutor, {} as LocalExecutor, config as never),
    ).toThrow('LocalExecutor is forbidden in production');
  });
});

async function collect(executor: IExecutor) {
  const events = [];
  for await (const event of executor.execute('task-1', 'user-1', authoringWorkspace(), {
    action: 'run',
    executionId: 'execution-1',
  })) {
    events.push(event);
  }
  return events;
}

function authoringWorkspace(): WorkspaceDTO {
  return {
    taskId: 'task-1',
    userId: 'user-1',
    workspace: {
      entry: 'index.js',
      files: [{ path: 'index.js', content: 'console.log("ok")' }],
    },
  };
}

function successfulChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: jest.Mock;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = jest.fn();
  setImmediate(() => {
    child.stdout.write('ok\n');
    child.emit('close', 0);
  });
  return child;
}

function hangingChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: jest.Mock;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = jest.fn(() => {
    child.emit('close', null);
    return true;
  });
  return child;
}

function closingChild(exitCode: number) {
  const child = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    kill: jest.Mock;
  };
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.kill = jest.fn();
  setImmediate(() => {
    child.emit('close', exitCode);
  });
  return child;
}

function stagingEntries(root: string): string[] {
  const staging = path.join(root, 'staging');
  return fs.existsSync(staging) ? fs.readdirSync(staging) : [];
}

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    Reflect.deleteProperty(process.env, name);
  } else {
    process.env[name] = value;
  }
}
