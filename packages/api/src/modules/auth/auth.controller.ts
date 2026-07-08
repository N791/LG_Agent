import { Controller, Request, Post, UseGuards, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { User } from '@prisma/client';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Request() req: { user: Partial<User> }) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refresh_token') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Public()
  @Post('ldap')
  @HttpCode(HttpStatus.OK)
  ldapLogin() {
    return { message: 'LDAP login placeholder' };
  }

  @Public()
  @Post('sso')
  @HttpCode(HttpStatus.OK)
  ssoLogin() {
    return { message: 'SSO login placeholder' };
  }
}
