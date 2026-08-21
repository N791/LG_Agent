import { Injectable } from '@nestjs/common';
import {
  PERMISSION_REGISTRY_VERSION,
  type MePermissionsDTO,
  type Permission,
} from '@lg-agent/contracts';
import { PrismaService } from '../../common/prisma.service';
import type { AuthorizationActor, ResolvedAuthorization } from './authorization.types';
import { AuthorizationMetricsService } from './authorization-metrics.service';
import { LegacyRoleBridgeService } from './legacy-role-bridge.service';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly legacyRoleBridge: LegacyRoleBridgeService,
    private readonly metrics: AuthorizationMetricsService,
  ) {}

  async resolve(actor: AuthorizationActor): Promise<ResolvedAuthorization> {
    const startedAt = process.hrtime.bigint();
    let assignments = await this.loadAssignments(actor);
    if (assignments.length === 0) {
      await this.legacyRoleBridge.lazyBackfill(actor);
      assignments = await this.loadAssignments(actor);
    }

    const permissionKeys = new Set<Permission>();
    const roles = assignments.map(({ role }) => {
      for (const grant of role.permissions) {
        if (!grant.permission.deprecatedAt) {
          permissionKeys.add(grant.permission.key as Permission);
        }
      }
      return { id: role.id, key: role.key, name: role.name };
    });
    this.metrics.observeResolution(
      Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
      assignments.length > 0 ? 'assigned' : 'unassigned',
    );
    return { roles, permissions: permissionKeys };
  }

  async me(actor: AuthorizationActor): Promise<MePermissionsDTO> {
    const resolved = await this.resolve(actor);
    return {
      registryVersion: PERMISSION_REGISTRY_VERSION,
      organizationId: actor.organizationId,
      roles: resolved.roles,
      permissions: [...resolved.permissions].sort(),
    };
  }

  private loadAssignments(actor: AuthorizationActor) {
    this.metrics.recordResolutionQuery('assignments');
    return this.prisma.userRole.findMany({
      where: {
        userId: actor.id,
        organizationId: actor.organizationId,
        user: { organizationId: actor.organizationId },
        OR: [
          { role: { organizationId: null } },
          { role: { organizationId: actor.organizationId } },
        ],
      },
      select: {
        role: {
          select: {
            id: true,
            key: true,
            name: true,
            permissions: {
              select: {
                permission: {
                  select: { key: true, deprecatedAt: true },
                },
              },
            },
          },
        },
      },
    });
  }
}
