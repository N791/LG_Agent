import { Body, Controller, Get, Param, Post, Put, Request } from '@nestjs/common';
import { PERMISSIONS, type Permission } from '@lg-agent/contracts';
import { AuthorizationService } from './authorization.service';
import { AuthorizationAdminService } from './authorization-admin.service';
import type { AuthorizationActor } from './authorization.types';
import { RequireAuthenticated, RequirePermission } from './require-permission.decorator';

@Controller()
export class AuthorizationController {
  constructor(
    private readonly authorization: AuthorizationService,
    private readonly admin: AuthorizationAdminService,
  ) {}

  @Get('me/permissions')
  @RequireAuthenticated()
  getMyPermissions(@Request() request: { user: AuthorizationActor }) {
    return this.authorization.me(request.user);
  }

  @Get('authorization/permissions')
  @RequirePermission(PERMISSIONS.ROLE_READ)
  listPermissions() {
    return this.admin.listPermissions();
  }

  @Get('authorization/roles')
  @RequirePermission(PERMISSIONS.ROLE_READ)
  listRoles(@Request() request: { user: AuthorizationActor }) {
    return this.admin.listRoles(request.user);
  }

  @Post('authorization/roles')
  @RequirePermission(PERMISSIONS.ROLE_MANAGE)
  createRole(
    @Request() request: { user: AuthorizationActor },
    @Body() body: { name: string; description?: string; permissionKeys?: Permission[] },
  ) {
    return this.admin.createRole(request.user, body);
  }

  @Post('authorization/roles/:roleId/copy')
  @RequirePermission(PERMISSIONS.ROLE_MANAGE)
  copyRole(
    @Request() request: { user: AuthorizationActor },
    @Param('roleId') roleId: string,
    @Body() body: { name: string; description?: string },
  ) {
    return this.admin.copyRole(request.user, roleId, body);
  }

  @Post('authorization/roles/:roleId/impact-preview')
  @RequirePermission(PERMISSIONS.ROLE_MANAGE)
  preview(
    @Request() request: { user: AuthorizationActor },
    @Param('roleId') roleId: string,
    @Body() body: { permissionKeys: Permission[] },
  ) {
    return this.admin.preview(request.user, roleId, body.permissionKeys);
  }

  @Put('authorization/roles/:roleId/permissions')
  @RequirePermission(PERMISSIONS.ROLE_MANAGE)
  updatePermissions(
    @Request() request: { user: AuthorizationActor },
    @Param('roleId') roleId: string,
    @Body() body: { permissionKeys: Permission[]; confirmation: string },
  ) {
    return this.admin.updatePermissions(request.user, roleId, body);
  }

  @Put('authorization/roles/:roleId/members')
  @RequirePermission(PERMISSIONS.ROLE_MANAGE)
  assignMembers(
    @Request() request: { user: AuthorizationActor },
    @Param('roleId') roleId: string,
    @Body() body: { userIds: string[]; confirmation: string; replace?: boolean },
  ) {
    return this.admin.assignMembers(request.user, roleId, body);
  }
}
