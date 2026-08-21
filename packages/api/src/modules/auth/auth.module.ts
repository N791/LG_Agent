import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AUTH_CONFIG, AuthConfigModule, type AuthConfig } from './auth-config.module';

@Module({
  imports: [
    UsersModule,
    AuthConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [AuthConfigModule],
      inject: [AUTH_CONFIG],
      useFactory: (config: AuthConfig) => ({
        secret: config.secret,
        signOptions: { algorithm: config.algorithm },
        verifyOptions: { algorithms: [config.algorithm] },
      }),
    }),
  ],
  providers: [AuthService, LocalStrategy, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, AuthConfigModule],
})
export class AuthModule {}
