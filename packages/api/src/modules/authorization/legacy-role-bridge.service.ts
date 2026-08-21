import { Injectable, Logger } from '@nestjs/common';
import { Prisma, type User } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import type { AuthorizationActor } from './authorization.types';
import { AuthorizationMetricsService } from './authorization-metrics.service';

export const LEGACY_ROLE_BRIDGE_COMPATIBILITY_END = '2.0.0';

type LegacyUser = Pick<User, 'id' | 'organizationId' | 'role'> &
  Partial<Pick<User, 'legacyRoleMigratedAt'>>;

@Injectable()
export class LegacyRoleBridgeService {
  private readonly logger = new Logger(LegacyRoleBridgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: AuthorizationMetricsService,
  ) {}

  async lazyBackfill(actor: AuthorizationActor): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      this.metrics.recordResolutionQuery('legacy_user');
      const user = await tx.user.findFirst({
        where: { id: actor.id, organizationId: actor.organizationId },
        select: { id: true, organizationId: true, role: true, legacyRoleMigratedAt: true },
      });
      if (!user || user.legacyRoleMigratedAt) return;
      await this.ensureSystemAssignment(tx, user, 'lazy_backfill');
    });
  }

  async userCreated(tx: Prisma.TransactionClient, user: LegacyUser): Promise<void> {
    await this.ensureSystemAssignment(tx, user, 'create');
  }

  async prepareUserUpdate(
    tx: Prisma.TransactionClient,
    before: LegacyUser,
    data: Prisma.UserUncheckedUpdateInput,
  ): Promise<void> {
    const nextOrganizationId = updatedString(data.organizationId);
    if (nextOrganizationId && nextOrganizationId !== before.organizationId) {
      await tx.userRole.deleteMany({ where: { userId: before.id } });
    }
  }

  async userUpdated(
    tx: Prisma.TransactionClient,
    before: LegacyUser,
    after: LegacyUser,
  ): Promise<void> {
    const organizationMoved = before.organizationId !== after.organizationId;
    const roleChanged = before.role !== after.role;
    if (!organizationMoved && !roleChanged) return;

    if (!organizationMoved) {
      await tx.userRole.deleteMany({
        where: {
          userId: after.id,
          organizationId: after.organizationId,
          role: { isSystem: true, organizationId: null },
        },
      });
    }
    await this.ensureSystemAssignment(
      tx,
      after,
      organizationMoved ? 'organization_move' : 'role_change',
    );
  }

  private async ensureSystemAssignment(
    tx: Prisma.TransactionClient,
    user: LegacyUser,
    reason: 'create' | 'lazy_backfill' | 'role_change' | 'organization_move',
  ): Promise<void> {
    this.metrics.recordResolutionQuery('legacy_role');
    const role = await tx.authorizationRole.findFirst({
      where: { key: user.role, organizationId: null, isSystem: true },
      select: { id: true },
    });
    if (!role) return;
    await tx.userRole.upsert({
      where: {
        userId_roleId_organizationId: {
          userId: user.id,
          roleId: role.id,
          organizationId: user.organizationId,
        },
      },
      create: {
        userId: user.id,
        roleId: role.id,
        organizationId: user.organizationId,
      },
      update: {},
    });
    await tx.user.update({
      where: { id: user.id },
      data: { legacyRoleMigratedAt: new Date() },
    });
    this.metrics.recordLegacyBridgeUse(reason);
    this.logger.warn(
      `Legacy users.role bridge used (${reason}); compatibility ends at ${LEGACY_ROLE_BRIDGE_COMPATIBILITY_END}`,
    );
  }
}

function updatedString(
  value: Prisma.UserUncheckedUpdateInput['organizationId'],
): string | undefined {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'set' in value && typeof value.set === 'string') {
    return value.set;
  }
  return undefined;
}
