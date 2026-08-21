import { createHash } from 'node:crypto';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_REGISTRY,
  PERMISSION_REGISTRY_VERSION,
  SYSTEM_ROLE_REGISTRY,
} from '@lg-agent/contracts';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';

export const AUTHORIZATION_REGISTRY_STATE_ID = 'permission-registry';
export const AUTHORIZATION_REGISTRY_MISMATCH_CODE = 'AUTH_REGISTRY_VERSION_MISMATCH';

export interface AuthorizationRegistryStatus {
  ready: boolean;
  code?: typeof AUTHORIZATION_REGISTRY_MISMATCH_CODE;
  expectedVersion: number;
  actualVersion: number | null;
  expectedDigest: string;
  actualDigest: string | null;
}

type RegistryClient = Prisma.TransactionClient | PrismaService;

export function authorizationRegistryDigest(): string {
  const canonical = {
    version: PERMISSION_REGISTRY_VERSION,
    permissions: [...PERMISSION_REGISTRY]
      .map((permission) => ({
        key: permission.key,
        scope: permission.scope,
        version: permission.version,
        description: permission.description,
        risk: permission.risk,
        replacement: permission.replacement ?? null,
      }))
      .sort((left, right) => left.key.localeCompare(right.key)),
    roles: SYSTEM_ROLE_REGISTRY.map((role) => ({
      ...role,
      permissions: [...DEFAULT_ROLE_PERMISSIONS[role.key]].sort(),
    })).sort((left, right) => left.key.localeCompare(right.key)),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

@Injectable()
export class AuthorizationRegistryService implements OnModuleInit {
  private readonly logger = new Logger(AuthorizationRegistryService.name);
  private status: AuthorizationRegistryStatus = this.mismatch(null, null);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    // Startup is deliberately read-only. Reconciliation is a release command.
    await this.refreshStatus();
  }

  currentStatus(): AuthorizationRegistryStatus {
    return this.status;
  }

  async refreshStatus(): Promise<AuthorizationRegistryStatus> {
    const expectedDigest = authorizationRegistryDigest();
    try {
      const state = await this.prisma.permissionRegistryState.findUnique({
        where: { id: AUTHORIZATION_REGISTRY_STATE_ID },
      });
      this.status =
        state?.registryVersion === PERMISSION_REGISTRY_VERSION &&
        state.registryDigest === expectedDigest
          ? {
              ready: true,
              expectedVersion: PERMISSION_REGISTRY_VERSION,
              actualVersion: state.registryVersion,
              expectedDigest,
              actualDigest: state.registryDigest,
            }
          : this.mismatch(state?.registryVersion ?? null, state?.registryDigest ?? null);
    } catch (error) {
      this.logger.error(
        `${AUTHORIZATION_REGISTRY_MISMATCH_CODE}: registry state could not be read`,
        error,
      );
      this.status = this.mismatch(null, null);
    }
    return this.status;
  }

  async reconcile(releaseVersion: string): Promise<AuthorizationRegistryStatus> {
    const digest = authorizationRegistryDigest();
    await this.prisma.$transaction(async (tx) => {
      // pg_advisory_xact_lock returns PostgreSQL void, which Prisma cannot
      // deserialize directly. The derived table preserves lock acquisition
      // while exposing a supported scalar result.
      await tx.$queryRaw`
        SELECT 1 AS acquired
        FROM (
          SELECT pg_advisory_xact_lock(hashtext('lg-agent:permission-registry'))
        ) AS registry_lock
      `;
      const current = await tx.permissionRegistryState.findUnique({
        where: { id: AUTHORIZATION_REGISTRY_STATE_ID },
      });
      if (current && current.registryVersion > PERMISSION_REGISTRY_VERSION) {
        throw new Error(
          `Refusing to downgrade permission registry ${String(current.registryVersion)} to ${String(PERMISSION_REGISTRY_VERSION)}`,
        );
      }

      await this.reconcilePermissions(tx);
      await this.reconcileSystemRoles(tx);
      await tx.permissionRegistryState.upsert({
        where: { id: AUTHORIZATION_REGISTRY_STATE_ID },
        create: {
          id: AUTHORIZATION_REGISTRY_STATE_ID,
          registryVersion: PERMISSION_REGISTRY_VERSION,
          registryDigest: digest,
          releaseVersion,
        },
        update: {
          registryVersion: PERMISSION_REGISTRY_VERSION,
          registryDigest: digest,
          releaseVersion,
          reconciledAt: new Date(),
        },
      });
    });
    return this.refreshStatus();
  }

  private async reconcilePermissions(tx: RegistryClient): Promise<void> {
    for (const permission of PERMISSION_REGISTRY) {
      await tx.permission.upsert({
        where: { key: permission.key },
        create: {
          key: permission.key,
          scope: permission.scope,
          registryVersion: permission.version,
          description: permission.description,
          risk: permission.risk,
          replacementKey: permission.replacement,
        },
        update: {
          scope: permission.scope,
          registryVersion: permission.version,
          description: permission.description,
          risk: permission.risk,
          replacementKey: permission.replacement,
          deprecatedAt: null,
        },
      });
    }
  }

  private async reconcileSystemRoles(tx: RegistryClient): Promise<void> {
    for (const definition of SYSTEM_ROLE_REGISTRY) {
      const existing = await tx.authorizationRole.findFirst({
        where: { key: definition.key, organizationId: null },
        select: { id: true },
      });
      const role = existing
        ? await tx.authorizationRole.update({
            where: { id: existing.id },
            data: {
              name: definition.name,
              description: definition.description,
              isSystem: true,
              version: PERMISSION_REGISTRY_VERSION,
            },
            select: { id: true },
          })
        : await tx.authorizationRole.create({
            data: {
              key: definition.key,
              name: definition.name,
              description: definition.description,
              isSystem: true,
              version: PERMISSION_REGISTRY_VERSION,
            },
            select: { id: true },
          });
      const permissionIds = await tx.permission.findMany({
        where: { key: { in: [...DEFAULT_ROLE_PERMISSIONS[definition.key]] } },
        select: { id: true },
      });
      if (permissionIds.length !== DEFAULT_ROLE_PERMISSIONS[definition.key].length) {
        throw new Error(`Permission registry is incomplete for system role ${definition.key}`);
      }
      await tx.rolePermission.deleteMany({ where: { roleId: role.id } });
      await tx.rolePermission.createMany({
        data: permissionIds.map(({ id }) => ({ roleId: role.id, permissionId: id })),
        skipDuplicates: true,
      });
    }
  }

  private mismatch(
    actualVersion: number | null,
    actualDigest: string | null,
  ): AuthorizationRegistryStatus {
    return {
      ready: false,
      code: AUTHORIZATION_REGISTRY_MISMATCH_CODE,
      expectedVersion: PERMISSION_REGISTRY_VERSION,
      actualVersion,
      expectedDigest: authorizationRegistryDigest(),
      actualDigest,
    };
  }
}
