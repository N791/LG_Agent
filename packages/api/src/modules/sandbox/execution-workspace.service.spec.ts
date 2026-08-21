import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { WorkspaceDTO } from '@lg-agent/contracts';
import { ExecutionWorkspaceService } from './execution-workspace.service';

describe('ExecutionWorkspaceService', () => {
  let testRoot: string;
  let service: ExecutionWorkspaceService;

  beforeEach(() => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-agent-epic68-'));
    service = new ExecutionWorkspaceService(path.join(testRoot, 'staging'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(testRoot, { recursive: true, force: true });
  });

  it.each([
    '../escape.ts',
    'nested/../../escape.ts',
    '/tmp/escape.ts',
    'C:\\escape.ts',
    'nested/C:/escape.ts',
    '\\\\server\\share\\escape.ts',
    'bad\0name.ts',
  ])('rejects unsafe authoring path %p', (unsafePath) => {
    const workspace = service.createExecutionWorkspace();
    const authoringWorkspace = dto(unsafePath, 'unsafe');

    expect(() => {
      service.stageAuthoringWorkspace(workspace, authoringWorkspace);
    }).toThrow(BadRequestException);
    expect(fs.existsSync(path.join(testRoot, 'escape.ts'))).toBe(false);
  });

  it('stages a validated copy and removes only the execution workspace', () => {
    const authoringWorkspace = dto('src/index.js', 'console.log("authoring")');
    const snapshot = JSON.stringify(authoringWorkspace);
    const workspace = service.createExecutionWorkspace();

    service.stageAuthoringWorkspace(workspace, authoringWorkspace);
    expect(fs.readFileSync(path.join(workspace.path, 'src', 'index.js'), 'utf8')).toBe(
      'console.log("authoring")',
    );

    service.cleanupExecutionWorkspace(workspace);
    expect(fs.existsSync(workspace.path)).toBe(false);
    expect(JSON.stringify(authoringWorkspace)).toBe(snapshot);
  });

  it('prevents a junction or symbolic-link escape', () => {
    const workspace = service.createExecutionWorkspace();
    const outside = path.join(testRoot, 'outside');
    const link = path.join(workspace.path, 'linked');
    fs.mkdirSync(outside);

    try {
      fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    } catch {
      return;
    }

    expect(() => {
      service.writeFile(workspace, 'linked/escape.ts', 'unsafe');
    }).toThrow(BadRequestException);
    expect(fs.existsSync(path.join(outside, 'escape.ts'))).toBe(false);
  });

  it('isolates concurrent execution workspaces', () => {
    const first = service.createExecutionWorkspace();
    const second = service.createExecutionWorkspace();

    service.writeFile(first, 'index.js', 'first');
    service.writeFile(second, 'index.js', 'second');

    expect(first.path).not.toBe(second.path);
    expect(fs.readFileSync(path.join(first.path, 'index.js'), 'utf8')).toBe('first');
    expect(fs.readFileSync(path.join(second.path, 'index.js'), 'utf8')).toBe('second');
  });

  it('contains cleanup failures so execution completion is not masked', () => {
    const failingService = new CleanupFailingExecutionWorkspaceService(
      path.join(testRoot, 'failing-staging'),
    );
    const workspace = failingService.createExecutionWorkspace();

    expect(() => {
      failingService.cleanupExecutionWorkspace(workspace);
    }).not.toThrow();
  });
});

class CleanupFailingExecutionWorkspaceService extends ExecutionWorkspaceService {
  protected override removeExecutionWorkspaceDirectory(): void {
    throw new Error('locked');
  }
}

function dto(filePath: string, content: string): WorkspaceDTO {
  return {
    taskId: 'authoring-task',
    userId: 'authoring-user',
    workspace: {
      entry: filePath,
      files: [{ path: filePath, content }],
    },
  };
}
