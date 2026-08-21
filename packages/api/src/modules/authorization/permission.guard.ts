import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { AuthorizationService } from './authorization.service';
import { AuthorizationAuditService } from './authorization-audit.service';
import type { AuthorizationActor } from './authorization.types';
import {
  REQUIRED_PERMISSIONS_KEY,
  type RequiredPermissionsMetadata,
} from './require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authorization: AuthorizationService,
    private readonly audit: AuthorizationAuditService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<RequiredPermissionsMetadata | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<Request & { user: AuthorizationActor }>();
    if (!required) {
      await this.audit.recordEvent({
        action: 'authorization.policy_missing',
        actorId: request.user.id,
        organizationId: request.user.organizationId,
        resourceId: request.originalUrl,
        severity: 'SECURITY',
        metadata: {
          organizationId: request.user.organizationId,
          method: request.method,
        },
      });
      throw new ForbiddenException('errors.authorization.permissionDeclarationMissing');
    }
    if (required.permissions.length === 0) return true;

    const resolved = await this.authorization.resolve(request.user);
    const allowed =
      required.mode === 'ANY'
        ? required.permissions.some((permission) => resolved.permissions.has(permission))
        : required.permissions.every((permission) => resolved.permissions.has(permission));
    if (allowed) return true;

    await this.audit.recordEvent({
      action: 'authorization.denied',
      actorId: request.user.id,
      organizationId: request.user.organizationId,
      resourceId: request.originalUrl,
      ipAddress: request.ip,
      userAgent: request.get('user-agent'),
      severity: 'SECURITY',
      metadata: {
        organizationId: request.user.organizationId,
        method: request.method,
        required: required.permissions,
      },
    });
    throw new ForbiddenException('errors.authorization.permissionDenied');
  }
}
