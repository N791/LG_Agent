import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PERMISSION_REGISTRY,
  type AuthorizationRoleDTO,
  type Permission,
} from '@lg-agent/contracts';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../common/prisma.service';
import type { AuthorizationActor } from './authorization.types';
import { AuthorizationAuditService } from './authorization-audit.service';

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissionKeys?: Permission[];
}

export interface UpdateRolePermissionsInput {
  permissionKeys: Permission[];
  confirmation: string;
}

export interface AssignRoleMembersInput {
  userIds: string[];
  confirmation: string;
  replace?: boolean;
}

@Injectable()
export class AuthorizationAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuthorizationAuditService,
  ) {}

  async listRoles(actor: AuthorizationActor): Promise<AuthorizationRoleDTO[]> {
    const roles = await this.prisma.authorizationRole.findMany({
      where: {
        OR: [{ organizationId: null }, { organizationId: actor.organizationId }],
        permissions: { none: { permission: { scope: 'PLATFORM' } } },
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
        users: {
          where: { organizationId: actor.organizationId },
          select: { userId: true },
        },
        _count: {
          select: { users: { where: { organizationId: actor.organizationId } } },
        },
      },
    });
    return roles.map((role) => ({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      system: role.isSystem,
      organizationId: role.organizationId,
      permissions: role.permissions.map(({ permission }) => permission.key as Permission).sort(),
      memberCount: role._count.users,
      memberIds: role.users.map(({ userId }) => userId),
    }));
  }

  listPermissions() {
    return PERMISSION_REGISTRY.filter((permission) => permission.scope === 'ORGANIZATION');
  }

  async createRole(
    actor: AuthorizationActor,
    input: CreateRoleInput,
  ): Promise<AuthorizationRoleDTO> {
    const name = input.name.trim();
    if (!name) throw new BadRequestException('errors.authorization.roleNameRequired');
    const permissionKeys = this.validateOrganizationPermissions(input.permissionKeys ?? []);
    const key = `${this.slug(name)}-${randomUUID().slice(0, 8)}`;
    const role = await this.prisma.authorizationRole.create({
      data: {
        organizationId: actor.organizationId,
        key,
        name,
        description: input.description?.trim(),
        permissions: {
          create: permissionKeys.map((permissionKey) => ({
            permission: { connect: { key: permissionKey } },
          })),
        },
      },
      include: {
        permissions: { select: { permission: { select: { key: true } } } },
      },
    });
    await this.recordChange(actor, 'authorization.role.created', role.id, null, {
      name,
      permissionKeys,
    });
    return {
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description,
      system: false,
      organizationId: role.organizationId,
      permissions: role.permissions.map(({ permission }) => permission.key as Permission),
      memberCount: 0,
    };
  }

  async copyRole(
    actor: AuthorizationActor,
    sourceRoleId: string,
    input: Pick<CreateRoleInput, 'name' | 'description'>,
  ): Promise<AuthorizationRoleDTO> {
    const source = await this.findScopedRole(actor, sourceRoleId);
    return this.createRole(actor, {
      name: input.name,
      description: input.description ?? `Copy of ${source.name}`,
      permissionKeys: source.permissions.map(({ permission }) => permission.key as Permission),
    });
  }

  async updatePermissions(
    actor: AuthorizationActor,
    roleId: string,
    input: UpdateRolePermissionsInput,
  ): Promise<void> {
    const role = await this.findScopedCustomRole(actor, roleId);
    this.assertConfirmation(input.confirmation, role.name);
    const next = this.validateOrganizationPermissions(input.permissionKeys);
    const before = role.permissions.map(({ permission }) => permission.key as Permission).sort();
    const permissionRows = await this.prisma.permission.findMany({
      where: { key: { in: next } },
      select: { id: true, key: true },
    });
    if (permissionRows.length !== next.length) {
      throw new ConflictException('errors.authorization.registryNotSynchronized');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionRows.length > 0) {
        await tx.rolePermission.createMany({
          data: permissionRows.map((permission) => ({
            roleId,
            permissionId: permission.id,
          })),
          skipDuplicates: true,
        });
      }
      await tx.authorizationRole.update({
        where: { id: roleId },
        data: { version: { increment: 1 } },
      });
    });
    await this.recordChange(actor, 'authorization.role.permissions_changed', roleId, before, next);
  }

  async assignMembers(
    actor: AuthorizationActor,
    roleId: string,
    input: AssignRoleMembersInput,
  ): Promise<void> {
    const role = await this.findScopedRole(actor, roleId);
    this.assertConfirmation(input.confirmation, role.name);
    if (role.permissions.some(({ permission }) => permission.scope === 'PLATFORM')) {
      throw new BadRequestException('errors.authorization.platformRoleAssignmentForbidden');
    }
    const userIds = [...new Set(input.userIds)];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds }, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (users.length !== userIds.length) {
      throw new NotFoundException('errors.authorization.memberNotFound');
    }

    const before = await this.prisma.userRole.findMany({
      where: { roleId, organizationId: actor.organizationId },
      select: { userId: true },
    });
    await this.prisma.$transaction(async (tx) => {
      if (input.replace) {
        await tx.userRole.deleteMany({
          where: { roleId, organizationId: actor.organizationId },
        });
      }
      await tx.userRole.createMany({
        data: userIds.map((userId) => ({
          userId,
          roleId,
          organizationId: actor.organizationId,
          assignedById: actor.id,
        })),
        skipDuplicates: true,
      });
    });
    await this.recordChange(
      actor,
      'authorization.role.members_changed',
      roleId,
      before.map(({ userId }) => userId),
      userIds,
    );
  }

  async preview(actor: AuthorizationActor, roleId: string, permissionKeys: Permission[]) {
    const role = await this.findScopedRole(actor, roleId);
    const next = this.validateOrganizationPermissions(permissionKeys);
    const before = role.permissions.map(({ permission }) => permission.key as Permission);
    const removed = before.filter((permission) => !next.includes(permission));
    const added = next.filter((permission) => !before.includes(permission));
    const memberCount = await this.prisma.userRole.count({
      where: { roleId, organizationId: actor.organizationId },
    });
    return {
      roleId,
      memberCount,
      added,
      removed,
      highRisk: [...added, ...removed].some(
        (key) => PERMISSION_REGISTRY.find((permission) => permission.key === key)?.risk === 'HIGH',
      ),
    };
  }

  private async findScopedRole(actor: AuthorizationActor, roleId: string) {
    const role = await this.prisma.authorizationRole.findFirst({
      where: {
        id: roleId,
        OR: [{ organizationId: null }, { organizationId: actor.organizationId }],
        permissions: { none: { permission: { scope: 'PLATFORM' } } },
      },
      include: {
        permissions: { select: { permission: { select: { id: true, key: true, scope: true } } } },
      },
    });
    if (!role) throw new NotFoundException('errors.authorization.roleNotFound');
    return role;
  }

  private async findScopedCustomRole(actor: AuthorizationActor, roleId: string) {
    const role = await this.findScopedRole(actor, roleId);
    if (role.isSystem || role.organizationId !== actor.organizationId) {
      throw new ConflictException('errors.authorization.systemRoleImmutable');
    }
    return role;
  }

  private validateOrganizationPermissions(keys: readonly Permission[]): Permission[] {
    const unique = [...new Set(keys)];
    const definitions = new Map(
      PERMISSION_REGISTRY.map((permission) => [permission.key, permission]),
    );
    for (const key of unique) {
      const definition = definitions.get(key);
      if (!definition) throw new BadRequestException('errors.authorization.unknownPermission');
      if (definition.scope !== 'ORGANIZATION') {
        throw new BadRequestException('errors.authorization.platformPermissionForbidden');
      }
    }
    return unique;
  }

  private assertConfirmation(confirmation: string, roleName: string): void {
    if (confirmation !== roleName) {
      throw new BadRequestException('errors.authorization.confirmationMismatch');
    }
  }

  private slug(value: string): string {
    return (
      value
        .normalize('NFKD')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 40) || 'custom-role'
    );
  }

  private recordChange(
    actor: AuthorizationActor,
    action: string,
    resourceId: string,
    before: unknown,
    after: unknown,
  ) {
    return this.audit.recordEvent({
      action,
      actorId: actor.id,
      organizationId: actor.organizationId,
      resourceId,
      before,
      after,
      severity: 'SECURITY',
      failureMode: 'REQUIRED',
    });
  }
}
