import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';
import { AUTH_CONFIG, type AuthConfig } from './auth-config.module';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @Inject(AUTH_CONFIG) private readonly authConfig: AuthConfig,
  ) {}

  async validateUser(username: string, pass: string): Promise<Partial<User> | null> {
    const user = await this.usersService.findByUsername(username);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password: _password, ...result } = user;
      return result;
    }
    return null;
  }

  login(user: Partial<User>) {
    const payload = {
      username: user.username,
      sub: user.id,
      role: user.role,
      organizationId: user.organizationId,
      tokenType: 'access',
      mustChangePassword: user.mustChangePassword ?? false,
    };
    const refreshPayload = { ...payload, tokenType: 'refresh' };
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: this.authConfig.accessTokenExpiresIn,
        algorithm: this.authConfig.algorithm,
      }),
      refresh_token: this.jwtService.sign(refreshPayload, {
        expiresIn: this.authConfig.refreshTokenExpiresIn,
        algorithm: this.authConfig.algorithm,
      }),
      must_change_password: user.mustChangePassword ?? false,
    };
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{
        username: string;
        sub: string;
        role: string;
        organizationId: string;
        tokenType?: string;
      }>(refreshToken, { algorithms: [this.authConfig.algorithm] });
      if (payload.tokenType !== 'refresh') {
        throw new UnauthorizedException('errors.auth.invalidToken');
      }
      const user = await this.usersService.findById(payload.sub);
      if (user?.status !== 1 || user.organizationId !== payload.organizationId) {
        throw new UnauthorizedException('errors.auth.invalidToken');
      }
      // Generate new tokens
      const newPayload = {
        username: user.username,
        sub: user.id,
        role: user.role,
        organizationId: user.organizationId,
        tokenType: 'access',
        mustChangePassword: user.mustChangePassword,
      };
      return {
        access_token: this.jwtService.sign(newPayload, {
          expiresIn: this.authConfig.accessTokenExpiresIn,
          algorithm: this.authConfig.algorithm,
        }),
        refresh_token: this.jwtService.sign(
          { ...newPayload, tokenType: 'refresh' },
          {
            expiresIn: this.authConfig.refreshTokenExpiresIn,
            algorithm: this.authConfig.algorithm,
          },
        ),
        must_change_password: user.mustChangePassword,
      };
    } catch (_e) {
      throw new UnauthorizedException('errors.auth.invalidToken');
    }
  }
}
