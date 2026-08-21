import { ForbiddenException, HttpException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { configValidationSchema } from '../../config/env.validation';
import { ExecutionManager } from '../../modules/sandbox/execution.manager';
import { SandboxSecurityConfig } from '../../modules/sandbox/sandbox-security.config';
import { TenantScopeService } from './tenant-scope.service';

const actor = {
  id: 'user-a',
  organizationId: 'organization-a',
  role: Role.TRAINEE,
};

describe('Epic 69 security invariants', () => {
  it('rejects known fallback JWT credentials', () => {
    const result = configValidationSchema.validate(
      { DATABASE_URL: 'postgresql://localhost/test', JWT_SECRET: 'secretKey' },
      { abortEarly: false },
    );
    expect(result.error?.message).toContain('JWT_SECRET');
  });

  it('builds an organization predicate for every tenant-owned resource', () => {
    const scope = new TenantScopeService({} as never);
    expect(scope.course(actor)).toEqual({ organizationId: 'organization-a' });
    expect(scope.task(actor)).toEqual({
      course: { organizationId: 'organization-a' },
    });
    expect(scope.workspace(actor)).toEqual({
      user: { organizationId: 'organization-a' },
      task: { course: { organizationId: 'organization-a' } },
    });
    expect(scope.submission(actor)).toEqual({
      user: { organizationId: 'organization-a' },
      task: { course: { organizationId: 'organization-a' } },
    });
    expect(scope.conversation(actor)).toEqual({ organizationId: 'organization-a' });
    expect(scope.discussion(actor)).toEqual({
      user: { organizationId: 'organization-a' },
      task: { course: { organizationId: 'organization-a' } },
    });
  });

  it('rejects a cross-tenant SSE claim even for a privileged role', () => {
    const manager = new ExecutionManager(policy());
    manager.reserve('execution-a', actor, 'task-a', 'run');

    expect(() => {
      manager.claim(
        'execution-a',
        { id: 'admin-b', organizationId: 'organization-b', role: Role.ADMIN },
        'task-a',
        'run',
      );
    }).toThrow(ForbiddenException);
  });

  it('rejects a different trainee in the same tenant but allows a mentor', () => {
    const manager = new ExecutionManager(policy());
    manager.reserve('execution-a', actor, 'task-a', 'test');

    expect(() => {
      manager.claim(
        'execution-a',
        { id: 'user-b', organizationId: 'organization-a', role: Role.TRAINEE },
        'task-a',
        'test',
      );
    }).toThrow(ForbiddenException);
    expect(() => {
      manager.claim(
        'execution-a',
        { id: 'mentor-a', organizationId: 'organization-a', role: Role.MENTOR },
        'task-a',
        'test',
      );
    }).not.toThrow();
  });

  it('enforces per-user execution concurrency', () => {
    const manager = new ExecutionManager(policy(1, 10));
    manager.reserve('execution-a', actor);
    expect(() => {
      manager.reserve('execution-b', actor);
    }).toThrow(HttpException);
  });

  it('requires a digest-pinned allowlisted sandbox image', () => {
    expect(
      () =>
        new SandboxSecurityConfig(
          config({
            SANDBOX_NODE_IMAGE: 'node:20-alpine',
            SANDBOX_IMAGE_ALLOWLIST: 'node:20-alpine',
          }),
        ),
    ).toThrow('pinned');
    expect(
      () =>
        new SandboxSecurityConfig(
          config({
            SANDBOX_NODE_IMAGE: `evil/image@sha256:${'a'.repeat(64)}`,
            SANDBOX_IMAGE_ALLOWLIST: 'node:20-alpine',
          }),
        ),
    ).toThrow('not allowlisted');
  });
});

function policy(userConcurrency = 2, organizationConcurrency = 10): SandboxSecurityConfig {
  return {
    policy: { userConcurrency, organizationConcurrency },
  } as SandboxSecurityConfig;
}

function config(overrides: Record<string, string>) {
  const values: Record<string, string | number> = {
    SANDBOX_MEMORY_LIMIT: '256m',
    SANDBOX_CPU_LIMIT: 0.5,
    SANDBOX_PIDS_LIMIT: 128,
    SANDBOX_TIMEOUT_MS: 30000,
    SANDBOX_USER_CONCURRENCY: 2,
    SANDBOX_ORG_CONCURRENCY: 10,
    ...overrides,
  };
  return {
    getOrThrow: (key: string) => values[key],
  } as never;
}
