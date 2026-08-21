import { Controller, Request, Post, UseGuards, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Public } from './decorators/public.decorator';
import { User } from '@prisma/client';
import { LoginRequestDTO, RefreshTokenRequestDTO } from '@lg-agent/contracts';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'Return JWT token.' })
  @ApiResponse({ status: 401, description: 'Unauthorized.' })
  @HttpCode(HttpStatus.OK)
  login(@Request() req: { user: Partial<User> }, @Body() _body: LoginRequestDTO) {
    return this.authService.login(req.user);
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh JWT token' })
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: RefreshTokenRequestDTO) {
    return this.authService.refresh(body.refresh_token);
  }
}
