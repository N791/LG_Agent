import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Algorithm, SignOptions } from 'jsonwebtoken';

export interface AuthConfig {
  secret: string;
  accessTokenExpiresIn: SignOptions['expiresIn'];
  refreshTokenExpiresIn: SignOptions['expiresIn'];
  algorithm: Algorithm;
}

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

export function createAuthConfig(config: ConfigService): AuthConfig {
  return {
    secret: config.getOrThrow<string>('JWT_SECRET'),
    accessTokenExpiresIn: config.get<string>(
      'JWT_ACCESS_EXPIRES_IN',
      '15m',
    ) as SignOptions['expiresIn'],
    refreshTokenExpiresIn: config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    ) as SignOptions['expiresIn'],
    algorithm: config.get<Algorithm>('JWT_ALGORITHM', 'HS256'),
  };
}

@Global()
@Module({
  providers: [
    {
      provide: AUTH_CONFIG,
      useFactory: createAuthConfig,
      inject: [ConfigService],
    },
  ],
  exports: [AUTH_CONFIG],
})
export class AuthConfigModule {}
