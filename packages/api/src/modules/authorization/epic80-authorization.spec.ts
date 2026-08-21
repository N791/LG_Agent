import { Role } from '@prisma/client';
import { PERMISSIONS, type Permission } from '@lg-agent/contracts';
import { AuthorizationService } from './authorization.service';
import { LegacyRoleBridgeService } from './legacy-role-bridge.service';
import type { AuthorizationActor } from './authorization.types';

const actor: AuthorizationActor = {
  id: 'user-a',
  organizationId: 'organization-a',
  role: Role.ADMIN,
};

describe('Epic 80 cluster-safe authorization', () => {
  it('denies on the next resolution in another service instance after revocation', async () => {
    let granted = true;
    const prisma = {
      userRole: {
        findMany: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve(granted ? [assignment(PERMISSIONS.USER_MANAGE)] : []),
          ),
      },
    };
    const bridge = { lazyBackfill: jest.fn() };
    const metrics = { recordResolutionQuery: jest.fn(), observeResolution: jest.fn() };
    const instanceA = new AuthorizationService(prisma as never, bridge as never, metrics as never);
    const instanceB = new AuthorizationService(prisma as never, bridge as never, metrics as never);

    expect((await instanceA.resolve(actor)).permissions.has(PERMISSIONS.USER_MANAGE)).toBe(true);
    granted = false;
    expect((await instanceB.resolve(actor)).permissions.has(PERMISSIONS.USER_MANAGE)).toBe(false);
    expect(prisma.userRole.findMany).toHaveBeenCalledTimes(3);
  });

  it('preserves custom roles when the legacy role changes', async () => {
    const tx = transaction();
    const bridge = legacyBridge();

    await bridge.userUpdated(
      tx as never,
      { id: actor.id, organizationId: actor.organizationId, role: Role.TRAINEE },
      { id: actor.id, organizationId: actor.organizationId, role: Role.MENTOR },
    );

    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: actor.id,
        organizationId: actor.organizationId,
        role: { isSystem: true, organizationId: null },
      },
    });
    expect(tx.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          userId: actor.id,
          roleId: 'system-role',
          organizationId: actor.organizationId,
        }) as object,
      }),
    );
  });

  it('removes source assignments before an organization move and creates only the target system role', async () => {
    const tx = transaction();
    const bridge = legacyBridge();
    const before = { id: actor.id, organizationId: 'organization-a', role: Role.MENTOR };
    const after = { ...before, organizationId: 'organization-b' };

    await bridge.prepareUserUpdate(tx as never, before, {
      organizationId: 'organization-b',
    });
    await bridge.userUpdated(tx as never, before, after);

    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: actor.id } });
    expect(tx.userRole.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ organizationId: 'organization-b' }) as object,
      }),
    );
  });

  it('lazy-backfills from the current database role rather than a stale token role', async () => {
    const tx = transaction();
    tx.user.findFirst.mockResolvedValue({
      id: actor.id,
      organizationId: actor.organizationId,
      role: Role.TRAINEE,
      legacyRoleMigratedAt: null,
    });
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const metrics = {
      recordResolutionQuery: jest.fn(),
      recordLegacyBridgeUse: jest.fn(),
    };
    const bridge = new LegacyRoleBridgeService(prisma as never, metrics as never);

    await bridge.lazyBackfill({ ...actor, role: Role.ADMIN });

    expect(tx.authorizationRole.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ key: Role.TRAINEE }) as object }),
    );
  });

  it('does not recreate a deliberately revoked assignment after legacy migration', async () => {
    const tx = transaction();
    tx.user.findFirst.mockResolvedValue({
      id: actor.id,
      organizationId: actor.organizationId,
      role: Role.ADMIN,
      legacyRoleMigratedAt: new Date(),
    });
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const bridge = new LegacyRoleBridgeService(
      prisma as never,
      { recordResolutionQuery: jest.fn(), recordLegacyBridgeUse: jest.fn() } as never,
    );

    await bridge.lazyBackfill(actor);

    expect(tx.authorizationRole.findFirst).not.toHaveBeenCalled();
    expect(tx.userRole.upsert).not.toHaveBeenCalled();
  });
});

function legacyBridge() {
  return new LegacyRoleBridgeService(
    {} as never,
    {
      recordResolutionQuery: jest.fn(),
      recordLegacyBridgeUse: jest.fn(),
    } as never,
  );
}

function transaction() {
  return {
    user: { findFirst: jest.fn(), update: jest.fn().mockResolvedValue({}) },
    userRole: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      upsert: jest.fn().mockResolvedValue({}),
    },
    authorizationRole: {
      findFirst: jest.fn().mockResolvedValue({ id: 'system-role' }),
    },
  };
}

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
