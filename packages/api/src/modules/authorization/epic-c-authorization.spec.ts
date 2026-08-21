import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_REGISTRY,
  type Permission,
} from '@lg-agent/contracts';
import { AuthorizationAdminService } from './authorization-admin.service';
import { AuthorizationService } from './authorization.service';
import { PermissionGuard } from './permission.guard';
import type { AuthorizationActor } from './authorization.types';

const actor: AuthorizationActor = {
  id: 'user-a',
  organizationId: 'organization-a',
  role: Role.ADMIN,
};

describe('Epic C authorization invariants', () => {
  it('keeps registry keys unique and excludes platform permissions from organization admin', () => {
    const keys = PERMISSION_REGISTRY.map(({ key }) => key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN).not.toContain(PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE);
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN).not.toContain(PERMISSIONS.SYSTEM_CONFIG_MANAGE);
  });

  it.each(Object.entries(DEFAULT_ROLE_PERMISSIONS).filter(([role]) => role !== 'PLATFORM_ADMIN'))(
    'maps every %s grant to a registered organization permission',
    (_role, permissions) => {
      const definitions = new Map(
        PERMISSION_REGISTRY.map((permission) => [permission.key, permission]),
      );
      for (const permission of permissions) {
        expect(definitions.get(permission)?.scope).toBe('ORGANIZATION');
      }
    },
  );

  it('registers every PLATFORM_ADMIN grant and keeps platform management out of ADMIN', () => {
    const definitions = new Map(
      PERMISSION_REGISTRY.map((permission) => [permission.key, permission]),
    );
    for (const permission of DEFAULT_ROLE_PERMISSIONS.PLATFORM_ADMIN) {
      expect(definitions.has(permission)).toBe(true);
    }
    expect(DEFAULT_ROLE_PERMISSIONS.PLATFORM_ADMIN).toContain(
      PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE,
    );
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN).not.toContain(PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE);
  });

  it('denies an endpoint without permission metadata', async () => {
    const guard = new PermissionGuard(
      reflector(undefined, false),
      { resolve: jest.fn() } as never,
      { recordEvent: jest.fn() } as never,
    );
    await expect(guard.canActivate(context(actor))).rejects.toThrow(ForbiddenException);
  });

  it.each([
    {
      name: 'horizontal privilege escalation',
      granted: [PERMISSIONS.USER_READ],
      required: [PERMISSIONS.USER_MANAGE],
    },
    {
      name: 'vertical privilege escalation',
      granted: [PERMISSIONS.ORGANIZATION_MANAGE],
      required: [PERMISSIONS.PLATFORM_ORGANIZATION_MANAGE],
    },
  ])('denies $name and records an audit event', async ({ granted, required }) => {
    const audit = { recordEvent: jest.fn().mockResolvedValue(undefined) };
    const guard = new PermissionGuard(
      reflector({ permissions: required, mode: 'ALL' }, false),
      {
        resolve: jest.fn().mockResolvedValue({
          roles: [],
          permissions: new Set<Permission>(granted),
        }),
      } as never,
      audit as never,
    );
    await expect(guard.canActivate(context(actor))).rejects.toThrow(ForbiddenException);
    expect(audit.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'authorization.denied',
        // Jest asymmetric matchers are intentionally untyped.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: expect.objectContaining({ organizationId: actor.organizationId }),
      }),
    );
  });

  it('isolates database-backed permission resolution by organization', async () => {
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([assignment(PERMISSIONS.USER_READ)])
      .mockResolvedValueOnce([assignment(PERMISSIONS.TASK_READ)]);
    const service = new AuthorizationService(
      { userRole: { findMany } } as never,
      { lazyBackfill: jest.fn() } as never,
      { recordResolutionQuery: jest.fn(), observeResolution: jest.fn() } as never,
    );

    const orgA = await service.resolve(actor);
    const orgB = await service.resolve({ ...actor, organizationId: 'organization-b' });

    expect(orgA.permissions.has(PERMISSIONS.USER_READ)).toBe(true);
    expect(orgA.permissions.has(PERMISSIONS.TASK_READ)).toBe(false);
    expect(orgB.permissions.has(PERMISSIONS.TASK_READ)).toBe(true);
    expect(findMany).toHaveBeenCalledTimes(2);
  });

  it('rejects platform grants and cross-organization role mutation', async () => {
    const audit = { recordEvent: jest.fn() };
    const prisma = {
      authorizationRole: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = new AuthorizationAdminService(prisma as never, audit as never);

    await expect(
      service.createRole(actor, {
        name: 'Unsafe role',
        permissionKeys: [PERMISSIONS.SYSTEM_CONFIG_MANAGE],
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.updatePermissions(actor, 'role-from-organization-b', {
        permissionKeys: [PERMISSIONS.USER_READ],
        confirmation: 'Role B',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects a partially unauthorized bulk member assignment atomically', async () => {
    const transaction = jest.fn();
    const service = new AuthorizationAdminService(
      {
        authorizationRole: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'role-a',
            name: 'Reviewer',
            organizationId: actor.organizationId,
            isSystem: false,
            permissions: [],
          }),
        },
        user: {
          findMany: jest.fn().mockResolvedValue([{ id: 'member-a' }]),
        },
        userRole: { findMany: jest.fn() },
        $transaction: transaction,
      } as never,
      { recordEvent: jest.fn() } as never,
    );

    await expect(
      service.assignMembers(actor, 'role-a', {
        userIds: ['member-a', 'member-from-organization-b'],
        confirmation: 'Reviewer',
        replace: true,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(transaction).not.toHaveBeenCalled();
  });
});

function assignment(permission: Permission) {
  return {
    role: {
      id: `role-${permission}`,
      key: 'CUSTOM',
      name: 'Custom',
      permissions: [{ permission: { key: permission, deprecatedAt: null } }],
    },
  };
}

function reflector(
  metadata: { permissions: Permission[]; mode: 'ALL' | 'ANY' } | undefined,
  isPublic: boolean,
): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValueOnce(isPublic).mockReturnValueOnce(metadata),
  } as unknown as Reflector;
}

function context(user: AuthorizationActor) {
  const request = {
    user,
    originalUrl: '/api/v1/users',
    method: 'POST',
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('jest'),
  };
  return {
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}
