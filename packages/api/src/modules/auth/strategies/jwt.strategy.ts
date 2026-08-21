import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { AUTH_CONFIG, type AuthConfig } from '../auth-config.module';
import { Inject } from '@nestjs/common';
import { UsersService } from '../../users';
import { UnauthorizedException } from '@nestjs/common';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(AUTH_CONFIG) config: AuthConfig,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.secret,
      algorithms: [config.algorithm],
    });
  }

  async validate(payload: {
    sub: string;
    username: string;
    role: string;
    organizationId: string;
    tokenType?: string;
  }) {
    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('errors.auth.invalidToken');
    }
    const user = await this.usersService.findById(payload.sub);
    if (user?.status !== 1 || user.organizationId !== payload.organizationId) {
      throw new UnauthorizedException('errors.auth.invalidToken');
    }
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId,
      mustChangePassword: user.mustChangePassword,
    };
  }
}
