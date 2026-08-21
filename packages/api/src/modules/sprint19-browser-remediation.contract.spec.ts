import { PATH_METADATA } from '@nestjs/common/constants';
import { spawnSync } from 'child_process';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  PERMISSIONS,
  SandboxRuntimeErrorCode,
  resolveStarterTemplate,
  schemas,
  type WorkspaceDTO,
} from '@lg-agent/contracts';
import { AiController } from './ai/ai.controller';
import { DiscussionsController } from './discussions/discussions.controller';
import { ProviderRegistry } from './ai/providers/provider-registry.service';
import type { AiConfigService } from './ai/ai-config.service';
import type { ILLMProvider } from './ai/interfaces/llm-provider.interface';
import { ExecutionWorkspaceService } from './sandbox/execution-workspace.service';
import { NodeRuntimeProfile } from './sandbox/node-runtime.profile';
import { FileSchemaRepository } from './schemas/repositories/file-schema.repository';
import { SchemaRegistryService } from './schemas/schema-registry.service';
import { WorkspaceInitializer } from './workspace/workspace.initializer';
import {
  REQUIRED_PERMISSIONS_KEY,
  type RequiredPermissionsMetadata,
} from './authorization/require-permission.decorator';

describe('Sprint 19 browser audit remediation contracts', () => {
  it('prefers the canonical starter template over both legacy fields', () => {
    const canonical = {
      version: 'v1',
      language: 'node' as const,
      entry: 'index.js',
      contentHash: 'abc',
      actions: {
        run: 'required' as const,
        build: 'required' as const,
        lint: 'required' as const,
        test: 'required' as const,
      },
      files: [{ path: 'index.js', content: 'canonical' }],
    };
    const resolved = resolveStarterTemplate(
      { starterTemplate: canonical, template: [{ path: 'legacy.js', content: 'legacy' }] },
      { files: [{ path: 'env.js', content: 'env' }] },
    );
    expect(resolved).toEqual({ source: 'canonical', template: canonical });
  });

  it('initializes the Golden Path from sandboxConfig instead of a Hello World fallback', async () => {
    const starterContent = 'const authMiddleware = () => undefined;';
    const starterDigest = sha256(starterContent);
    const starterHash = sha256(`index.js\0${starterDigest}`);
    let stagedPaths: string[] = [];
    const createdWorkspace = {
      id: 'workspace-1',
      taskId: 'task-1',
      userId: 'user-1',
      status: 'DRAFT',
      files: [
        {
          id: 'file-1',
          path: 'index.js',
          content: starterContent,
          language: 'javascript',
          encoding: null,
          readonly: false,
          hidden: false,
        },
      ],
    };
    const create = jest.fn((input: { data: { files: { create: { path: string }[] } } }) => {
      stagedPaths = input.data.files.create.map((file) => file.path);
      return Promise.resolve(createdWorkspace);
    });
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-1' }) },
      workspace: { findFirst: jest.fn().mockResolvedValue(null) },
      task: {
        findFirst: jest.fn().mockResolvedValue({
          envConfig: {},
          sandboxConfig: {
            starterTemplate: {
              version: 'v1',
              language: 'node',
              entry: 'index.js',
              contentHash: starterHash,
              actions: { run: 'required', build: 'required', lint: 'required', test: 'required' },
              files: [
                {
                  path: 'index.js',
                  content: starterContent,
                  language: 'javascript',
                  sha256: starterDigest,
                },
              ],
            },
          },
        }),
      },
      $transaction: jest.fn((callback: (tx: { workspace: { create: typeof create } }) => unknown) =>
        callback({ workspace: { create } }),
      ),
    };
    const workspace = await new WorkspaceInitializer(prisma as never).initialize(
      'task-1',
      'user-1',
    );
    expect(stagedPaths).toEqual(['index.js']);
    expect(workspace.workspace.entry).toBe('index.js');
    expect(workspace.workspace.metadata?.['templateHash']).toBe(starterHash);
  });

  it('registers canonical schema ids and compatibility aliases without collisions', () => {
    const registry = new SchemaRegistryService();
    new FileSchemaRepository(registry).onModuleInit();
    for (const [name, schema] of Object.entries(schemas)) {
      expect(registry.getSchema(name)).toBe(schema);
      expect(registry.getSchema(schema.$id)).toBe(schema);
    }
    expect(() => {
      registry.registerSchema('env', { $id: 'conflict' });
    }).toThrow('errors.schema.conflict');
  });

  it('fails fast for TypeScript on Node 20 and never emits no-op npm commands', () => {
    const profile = new NodeRuntimeProfile();
    expect(profile.command('test', 'index.js')).toEqual({
      executable: 'npm',
      args: ['run', 'test'],
    });
    expect(() => profile.command('run', 'index.ts')).toThrow(
      SandboxRuntimeErrorCode.TYPESCRIPT_RUNNER_UNAVAILABLE,
    );
  });

  it('rejects missing Node manifests, scripts and entries with stable codes', () => {
    const executionWorkspace = new ExecutionWorkspaceService('tmp/sprint19-contract');
    const withoutManifest = workspace([{ path: 'index.js', content: 'console.log(1)' }]);
    expect(() => {
      executionWorkspace.assertActionInputs(withoutManifest, 'test', {
        language: 'node',
        version: '20',
        entry: 'index.js',
      });
    }).toThrow(SandboxRuntimeErrorCode.MANIFEST_MISSING);
    const withoutScript = workspace([
      { path: 'index.js', content: 'console.log(1)' },
      { path: 'package.json', content: '{"scripts":{}}' },
    ]);
    expect(() => {
      executionWorkspace.assertActionInputs(withoutScript, 'test', {
        language: 'node',
        version: '20',
        entry: 'index.js',
      });
    }).toThrow(SandboxRuntimeErrorCode.SCRIPT_MISSING);
    expect(() => {
      executionWorkspace.assertActionInputs(withoutManifest, 'run', {
        language: 'node',
        version: '20',
        entry: 'missing.js',
      });
    }).toThrow(SandboxRuntimeErrorCode.ENTRY_MISSING);
  });

  it('declares the analytics route before the dynamic discussion id route', () => {
    const methods = Object.getOwnPropertyNames(DiscussionsController.prototype);
    expect(methods.indexOf('getAnalytics')).toBeLessThan(methods.indexOf('getDiscussionDetails'));
    const analyticsMethod = Object.getOwnPropertyDescriptor(
      DiscussionsController.prototype,
      'getAnalytics',
    )?.value as (() => unknown) | undefined;
    if (!analyticsMethod) throw new Error('getAnalytics route handler is missing.');
    expect(Reflect.getMetadata(PATH_METADATA, analyticsMethod) as string).toBe('analytics');
  });

  it('refuses Mock Provider outside explicit test fixtures', async () => {
    const config = {
      getDefaultProvider: jest.fn().mockResolvedValue('mock'),
      getMockConfig: jest.fn().mockResolvedValue({ enabled: false }),
    } as unknown as AiConfigService;
    const registry = new ProviderRegistry(config);
    registry.register({ name: 'mock' } as ILLMProvider);
    await expect(registry.getFallbackProvider()).rejects.toThrow('AI_PROVIDER_NOT_CONFIGURED');
  });

  it('protects retrieval activation/retry and rejects an invalid index kind', async () => {
    for (const methodName of ['activateRetrievalIndex', 'retryRetrievalIndex'] as const) {
      const handler = Object.getOwnPropertyDescriptor(AiController.prototype, methodName)?.value as
        ((...args: unknown[]) => unknown) | undefined;
      expect(handler).toBeDefined();
      const metadata = Reflect.getMetadata(
        REQUIRED_PERMISSIONS_KEY,
        handler as (...args: unknown[]) => unknown,
      ) as RequiredPermissionsMetadata;
      expect(metadata).toEqual({
        permissions: [PERMISSIONS.AI_RETRIEVAL_MANAGE],
        mode: 'ALL',
      });
    }

    const controller = Object.create(AiController.prototype) as AiController;
    await expect(
      controller.activateRetrievalIndex(
        { user: { id: 'user-1', organizationId: 'org-1', role: 'ADMIN' } },
        'UNKNOWN',
        'index-1',
      ),
    ).rejects.toThrow('RETRIEVAL_INDEX_KIND_INVALID');
  });

  it('rejects the untouched/Hello World implementations and passes only signature verification', () => {
    const untouched = runGoldenCase();
    expect(untouched.status).not.toBe(0);
    expect(untouched.output).toContain('Forged token was accepted');

    const helloWorld = runGoldenCase(
      'console.log("Hello World");\nmodule.exports = () => undefined;\n',
    );
    expect(helloWorld.status).not.toBe(0);

    const fixedSource = fs
      .readFileSync(path.join(goldenFixtureRoot(), 'template', 'index.js'), 'utf8')
      .replace(
        'const decoded = jwt.decode(token);',
        'const decoded = jwt.verify(token, JWT_SECRET);',
      );
    const fixed = runGoldenCase(fixedSource);
    expect(fixed.status).toBe(0);
    expect(fixed.output).toContain('Test 1 Passed');
    expect(fixed.output).toContain('Test 2 Passed');
    expect(fixed.output).toContain('Test 3 Passed');
  });
});

function workspace(files: WorkspaceDTO['workspace']['files']): WorkspaceDTO {
  return { taskId: 'task-1', userId: 'user-1', workspace: { files } };
}

function runGoldenCase(indexSource?: string): { status: number | null; output: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lg-agent-golden-case-'));
  try {
    fs.cpSync(path.join(goldenFixtureRoot(), 'template'), root, { recursive: true });
    fs.copyFileSync(path.join(goldenFixtureRoot(), 'test', 'test.js'), path.join(root, 'test.js'));
    if (indexSource !== undefined) fs.writeFileSync(path.join(root, 'index.js'), indexSource);
    const result = spawnSync(process.execPath, ['test.js'], {
      cwd: root,
      encoding: 'utf8',
      timeout: 10_000,
    });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function goldenFixtureRoot(): string {
  return path.resolve(__dirname, '../../prisma/seeds/golden-case');
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
