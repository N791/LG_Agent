import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';

import {
  SandboxRuntimeErrorCode,
  type RuntimeEnvironmentDTO,
  type SandboxAction,
  type WorkspaceDTO,
} from '@lg-agent/contracts';
import { EXECUTION_WORKSPACE_ROOT } from './sandbox.tokens';
import { SandboxRuntimeError } from './runtime-profile.registry';

export interface ExecutionWorkspace {
  executionWorkspaceId: string;
  path: string;
}

@Injectable()
export class ExecutionWorkspaceService {
  private readonly logger = new Logger(ExecutionWorkspaceService.name);
  private readonly stagingRoot: string;

  constructor(@Optional() @Inject(EXECUTION_WORKSPACE_ROOT) stagingRoot?: string) {
    this.stagingRoot = path.resolve(
      stagingRoot ?? path.join(os.tmpdir(), 'lg-agent-execution-workspaces'),
    );
  }

  createExecutionWorkspace(): ExecutionWorkspace {
    fs.mkdirSync(this.stagingRoot, { recursive: true });
    this.assertNoSymlink(this.stagingRoot);

    const executionWorkspaceId = `exec_${randomUUID()}`;
    const workspacePath = this.resolveContainedPath(this.stagingRoot, executionWorkspaceId);
    fs.mkdirSync(workspacePath, { recursive: false });
    this.assertNoSymlink(workspacePath);

    this.logger.debug(`Created execution workspace at ${workspacePath}`);
    return { executionWorkspaceId, path: workspacePath };
  }

  stageAuthoringWorkspace(workspace: ExecutionWorkspace, authoringWorkspace: WorkspaceDTO): void {
    this.assertExecutionWorkspace(workspace);
    for (const file of authoringWorkspace.workspace.files) {
      this.writeFile(
        workspace,
        file.path,
        file.content,
        (file.encoding as BufferEncoding | undefined) ?? 'utf-8',
      );
    }

    const packageJsonFile = this.resolveContainedPath(workspace.path, 'package.json');
    if (!fs.existsSync(packageJsonFile)) {
      this.writeFile(
        workspace,
        'package.json',
        JSON.stringify(
          {
            name: `sandbox-${workspace.executionWorkspaceId}`,
            version: '1.0.0',
            description: 'LG_Agent execution workspace',
          },
          null,
          2,
        ),
      );
    }
  }

  assertActionInputs(
    authoringWorkspace: WorkspaceDTO,
    action: SandboxAction,
    environment: RuntimeEnvironmentDTO,
  ): void {
    const files = new Map(authoringWorkspace.workspace.files.map((file) => [file.path, file]));
    if (action === 'run') {
      if (!files.has(environment.entry)) {
        throw new SandboxRuntimeError(
          SandboxRuntimeErrorCode.ENTRY_MISSING,
          `Runtime entry "${environment.entry}" does not exist in the execution workspace.`,
        );
      }
      return;
    }

    // Sprint 19 changes only Node semantics. Other language profiles keep their
    // existing image commands and scoring behavior.
    if (environment.language !== 'node') return;

    const manifest = files.get('package.json');
    if (!manifest) {
      throw new SandboxRuntimeError(
        SandboxRuntimeErrorCode.MANIFEST_MISSING,
        `Node action "${action}" requires package.json.`,
      );
    }
    let parsed: { scripts?: Record<string, unknown> };
    try {
      parsed = JSON.parse(manifest.content) as { scripts?: Record<string, unknown> };
    } catch {
      throw new SandboxRuntimeError(
        SandboxRuntimeErrorCode.MANIFEST_MISSING,
        'package.json is not valid JSON.',
      );
    }
    const actionScript = parsed.scripts?.[action];
    if (typeof actionScript !== 'string' || !actionScript.trim()) {
      throw new SandboxRuntimeError(
        SandboxRuntimeErrorCode.SCRIPT_MISSING,
        `Node action "${action}" requires a non-empty package.json script.`,
      );
    }
  }

  writeFile(
    workspace: ExecutionWorkspace,
    relativePath: string,
    content: string,
    encoding: BufferEncoding = 'utf-8',
  ): void {
    this.assertExecutionWorkspace(workspace);
    const filePath = this.resolveContainedPath(workspace.path, relativePath);
    this.createContainedDirectory(workspace.path, path.dirname(filePath));

    if (fs.existsSync(filePath)) {
      this.assertNoSymlink(filePath);
    }
    this.assertRealPathContained(workspace.path, path.dirname(filePath));
    fs.writeFileSync(filePath, content, { encoding, flag: 'w' });
    this.assertRealPathContained(workspace.path, filePath);
  }

  validateRelativePath(relativePath: string): string {
    if (
      !relativePath ||
      relativePath.includes('\0') ||
      path.posix.isAbsolute(relativePath) ||
      path.win32.isAbsolute(relativePath) ||
      relativePath.includes(':')
    ) {
      throw new BadRequestException('Invalid execution workspace path');
    }

    const normalized = relativePath.replace(/\\/g, '/');
    const segments = normalized.split('/');
    if (segments.some((segment) => segment === '..' || segment === '')) {
      throw new BadRequestException('Execution workspace path escapes staging root');
    }

    return segments.filter((segment) => segment !== '.').join('/');
  }

  validateEntryPoint(relativePath: string): string {
    const normalized = this.validateRelativePath(relativePath);
    if (!/^[\p{L}\p{N}._/@+\- ]+$/u.test(normalized)) {
      throw new BadRequestException('Execution entry point contains unsafe characters');
    }
    return normalized;
  }

  cleanupExecutionWorkspace(workspace: ExecutionWorkspace): void {
    try {
      this.assertExecutionWorkspace(workspace);
      if (fs.existsSync(workspace.path)) {
        this.removeExecutionWorkspaceDirectory(workspace.path);
        this.logger.debug(`Cleaned up execution workspace at ${workspace.path}`);
      }
    } catch (error: unknown) {
      this.logger.error(
        `Failed to cleanup execution workspace ${workspace.path}: ${(error as Error).message}`,
      );
    }
  }

  protected removeExecutionWorkspaceDirectory(workspacePath: string): void {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }

  private assertExecutionWorkspace(workspace: ExecutionWorkspace): void {
    const expectedPath = this.resolveContainedPath(
      this.stagingRoot,
      workspace.executionWorkspaceId,
    );
    if (path.resolve(workspace.path) !== expectedPath) {
      throw new BadRequestException('Execution workspace is outside staging root');
    }
    if (fs.existsSync(workspace.path)) {
      this.assertNoSymlink(workspace.path);
      this.assertRealPathContained(this.stagingRoot, workspace.path);
    }
  }

  private resolveContainedPath(root: string, relativePath: string): string {
    const normalized = this.validateRelativePath(relativePath);
    const resolvedRoot = path.resolve(root);
    const resolved = path.resolve(resolvedRoot, normalized);
    const relation = path.relative(resolvedRoot, resolved);
    if (
      !relation ||
      relation.startsWith(`..${path.sep}`) ||
      relation === '..' ||
      path.isAbsolute(relation)
    ) {
      throw new BadRequestException('Execution workspace path escapes staging root');
    }
    return resolved;
  }

  private createContainedDirectory(root: string, directory: string): void {
    const relation = path.relative(path.resolve(root), path.resolve(directory));
    if (relation.startsWith(`..${path.sep}`) || relation === '..' || path.isAbsolute(relation)) {
      throw new BadRequestException('Execution workspace directory escapes staging root');
    }

    let cursor = path.resolve(root);
    for (const segment of relation.split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, segment);
      if (fs.existsSync(cursor)) {
        this.assertNoSymlink(cursor);
      } else {
        fs.mkdirSync(cursor);
      }
    }
    this.assertRealPathContained(root, cursor);
  }

  private assertNoSymlink(target: string): void {
    if (fs.lstatSync(target).isSymbolicLink()) {
      throw new BadRequestException('Symbolic links are not allowed in execution workspaces');
    }
  }

  private assertRealPathContained(root: string, target: string): void {
    const realRoot = fs.realpathSync(root);
    const realTarget = fs.realpathSync(target);
    const relation = path.relative(realRoot, realTarget);
    if (relation.startsWith(`..${path.sep}`) || relation === '..' || path.isAbsolute(relation)) {
      throw new BadRequestException('Execution workspace path escapes staging root');
    }
  }
}
