import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_REGISTRY,
  PERMISSION_REGISTRY_VERSION,
  SYSTEM_ROLE_REGISTRY,
} from '@lg-agent/contracts';
import {
  AUTHORIZATION_REGISTRY_MISMATCH_CODE,
  AuthorizationRegistryService,
  authorizationRegistryDigest,
} from './authorization-registry.service';

describe('Epic 81 permission registry contract', () => {
  it('keeps the TypeScript registry equivalent to the initial SQL data', () => {
    const sql = initialAuthorizationSql();
    const permissionRows = [
      ...sql.matchAll(/\('([^']+)', '([^']+)', (\d+), '([^']*)', '([^']+)'\)/g),
    ].map((match) => ({
      key: match[1],
      scope: match[2],
      version: Number(match[3]),
      description: match[4],
      risk: match[5],
    }));
    expect(permissionRows).toEqual(
      PERMISSION_REGISTRY.map(({ replacement: _replacement, ...permission }) => permission),
    );

    const roleMapSql = sql.slice(sql.indexOf('WITH role_map'));
    const actualRolePermissions = [...roleMapSql.matchAll(/\('([^']+)', '([^']+)'\)/g)].map(
      (match) => {
        const role = match[1];
        const permission = match[2];
        if (!role || !permission)
          throw new Error('Invalid role mapping in authorization migration');
        return `${role}:${permission}`;
      },
    );
    const expectedRolePermissions = SYSTEM_ROLE_REGISTRY.flatMap((role) =>
      DEFAULT_ROLE_PERMISSIONS[role.key].map((permission) => `${role.key}:${permission}`),
    );
    expect(actualRolePermissions).toEqual(expectedRolePermissions);
  });

  it('performs only a read-only registry check during module initialization', async () => {
    const prisma = {
      permissionRegistryState: {
        findUnique: jest.fn().mockResolvedValue({
          registryVersion: PERMISSION_REGISTRY_VERSION,
          registryDigest: authorizationRegistryDigest(),
        }),
        upsert: jest.fn(),
      },
      permission: { upsert: jest.fn() },
    };
    const registry = new AuthorizationRegistryService(prisma as never);

    await registry.onModuleInit();

    expect(registry.currentStatus().ready).toBe(true);
    expect(prisma.permissionRegistryState.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.permissionRegistryState.upsert).not.toHaveBeenCalled();
    expect(prisma.permission.upsert).not.toHaveBeenCalled();
  });

  it('fails closed with a stable code when version or digest differs', async () => {
    const prisma = {
      permissionRegistryState: {
        findUnique: jest.fn().mockResolvedValue({
          registryVersion: PERMISSION_REGISTRY_VERSION + 1,
          registryDigest: 'different',
        }),
      },
    };
    const registry = new AuthorizationRegistryService(prisma as never);

    const status = await registry.refreshStatus();

    expect(status).toMatchObject({
      ready: false,
      code: AUTHORIZATION_REGISTRY_MISMATCH_CODE,
      actualVersion: PERMISSION_REGISTRY_VERSION + 1,
    });
  });
});

function initialAuthorizationSql(): string {
  return readFileSync(
    resolve(
      __dirname,
      '../../../prisma/migrations/20260729000000_epic_c_authorization/migration.sql',
    ),
    'utf8',
  );
}
