import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
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
    };
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
    };
  }

  refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify<{
        username: string;
        sub: string;
        role: string;
        organizationId: string;
      }>(refreshToken);
      // Generate new tokens
      const newPayload = {
        username: payload.username,
        sub: payload.sub,
        role: payload.role,
        organizationId: payload.organizationId,
      };
      return {
        access_token: this.jwtService.sign(newPayload, { expiresIn: '15m' }),
        refresh_token: this.jwtService.sign(newPayload, { expiresIn: '7d' }),
      };
    } catch (_e) {
      throw new UnauthorizedException('errors.auth.invalidToken');
    }
  }
}
