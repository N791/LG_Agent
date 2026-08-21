import { ForbiddenException, Injectable, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    const activated = await Promise.resolve(super.canActivate(context));
    if (!activated) return false;
    const request = context.switchToHttp().getRequest<{
      user?: { mustChangePassword?: boolean };
      method?: string;
      route?: { path?: string };
    }>();
    const isPasswordChange =
      request.method === 'POST' && request.route?.path === '/users/me/change-password';
    if (request.user?.mustChangePassword && !isPasswordChange) {
      throw new ForbiddenException('errors.auth.passwordChangeRequired');
    }
    return true;
  }
}
