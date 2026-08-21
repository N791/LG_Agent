import { Body, Controller, Delete, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PERMISSIONS,
  type CreateMobileHandoffRequestDTO,
  type MobileDeviceRegistrationRequestDTO,
} from '@lg-agent/contracts';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { RequirePermission } from '../authorization';
import { MobileSessionService } from './mobile-session.service';

interface AuthenticatedRequest {
  user: TenantActor;
}

@ApiTags('Mobile lifecycle')
@Controller()
export class MobileLifecycleController {
  constructor(private readonly sessions: MobileSessionService) {}

  @Post('device-registrations')
  @RequirePermission(PERMISSIONS.PROFILE_UPDATE)
  @ApiOperation({ summary: 'Register or rotate an Android push token' })
  registerDevice(
    @Req() request: AuthenticatedRequest,
    @Body() body: MobileDeviceRegistrationRequestDTO,
  ) {
    return this.sessions.registerDevice(request.user, body);
  }

  @Delete('device-registrations/:id')
  @HttpCode(204)
  @RequirePermission(PERMISSIONS.PROFILE_UPDATE)
  @ApiOperation({ summary: 'Revoke a tenant and actor-scoped device registration' })
  revokeDevice(@Req() request: AuthenticatedRequest, @Param('id') id: string): void {
    this.sessions.revokeDevice(request.user, id);
  }

  @Post('handoffs')
  @RequirePermission(PERMISSIONS.WORKSPACE_USE)
  @ApiOperation({ summary: 'Create a short-lived, single-use PC handoff' })
  createHandoff(@Req() request: AuthenticatedRequest, @Body() body: CreateMobileHandoffRequestDTO) {
    return this.sessions.createHandoff(request.user, body);
  }

  @Post('handoffs/:token/consume')
  @RequirePermission(PERMISSIONS.WORKSPACE_USE)
  @ApiOperation({ summary: 'Consume a handoff once for the same actor and organization' })
  consumeHandoff(@Req() request: AuthenticatedRequest, @Param('token') token: string) {
    return this.sessions.consumeHandoff(request.user, token);
  }
}
