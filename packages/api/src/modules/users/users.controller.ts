import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Request,
  Put,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserPreferenceService } from './user-preference.service';
import { Prisma } from '@prisma/client';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import * as bcrypt from 'bcryptjs';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import {
  ChangePasswordRequestDTO,
  SetPreferenceRequestDTO,
  UpdateProfileRequestDTO,
} from '@lg-agent/contracts';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userPreferenceService: UserPreferenceService,
  ) {}

  // ---- Self-service profile endpoints (any authenticated user) ----

  @Get('me')
  @RequirePermission(PERMISSIONS.PROFILE_READ)
  async getProfile(@Request() req: { user: { id: string } }) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new BadRequestException('errors.auth.userNotFound');
    const { password: _pw, ...profile } = user;
    return profile;
  }

  @Patch('me')
  @RequirePermission(PERMISSIONS.PROFILE_UPDATE)
  async updateProfile(
    @Request() req: { user: { id: string } },
    @Body() body: UpdateProfileRequestDTO,
  ) {
    const data: Prisma.UserUncheckedUpdateInput = {};
    if (body.nickname !== undefined) data.nickname = body.nickname;
    if (body.email !== undefined) data.email = body.email;
    const user = await this.usersService.update(req.user.id, data);
    const { password: _pw, ...profile } = user;
    return profile;
  }

  @Post('me/change-password')
  @RequirePermission(PERMISSIONS.PROFILE_UPDATE)
  async changePassword(
    @Request() req: { user: { id: string } },
    @Body() body: ChangePasswordRequestDTO,
  ) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new BadRequestException('errors.auth.userNotFound');

    const isMatch = await bcrypt.compare(body.currentPassword, user.password);
    if (!isMatch) throw new BadRequestException('errors.auth.passwordIncorrect');
    if (body.newPassword.length < 12 || body.newPassword === body.currentPassword) {
      throw new BadRequestException('errors.auth.passwordPolicy');
    }

    const hashedPassword = await bcrypt.hash(body.newPassword, 10);
    await this.usersService.update(req.user.id, {
      password: hashedPassword,
      mustChangePassword: false,
    });
    return { success: true };
  }

  @Get('me/preferences')
  @RequirePermission(PERMISSIONS.PROFILE_READ)
  async getPreferences(@Request() req: { user: { id: string } }) {
    return this.userPreferenceService.getAll(req.user.id);
  }

  @Put('me/preferences/:key')
  @RequirePermission(PERMISSIONS.PROFILE_UPDATE)
  async setPreference(
    @Request() req: { user: { id: string } },
    @Param('key') key: string,
    @Body() body: SetPreferenceRequestDTO,
  ) {
    return this.userPreferenceService.set(req.user.id, key, body.value);
  }

  // ---- Admin CRUD endpoints ----

  @Post()
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  async create(
    @Request() req: { user: TenantActor },
    @Body() createUserDto: Prisma.UserUncheckedCreateInput,
  ) {
    if (createUserDto.password) {
      createUserDto.password = await bcrypt.hash(createUserDto.password, 10);
    }
    return this.usersService.create({
      ...createUserDto,
      organizationId: req.user.organizationId,
    });
  }

  @Get()
  @RequirePermission(PERMISSIONS.USER_READ)
  findAll(@Request() req: { user: TenantActor }) {
    return this.usersService.findAll(req.user.organizationId);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.USER_READ)
  findOne(@Param('id') id: string, @Request() req: { user: TenantActor }) {
    return this.usersService.findByIdScoped(id, req.user.organizationId);
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: Prisma.UserUncheckedUpdateInput,
    @Request() req: { user: TenantActor },
  ) {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password as string, 10);
    }
    const { organizationId: _organizationId, ...safeUpdate } = updateUserDto;
    await this.usersService.findByIdScoped(id, req.user.organizationId);
    return this.usersService.update(id, safeUpdate);
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.USER_MANAGE)
  async remove(@Param('id') id: string, @Request() req: { user: TenantActor }) {
    await this.usersService.findByIdScoped(id, req.user.organizationId);
    return this.usersService.remove(id);
  }
}
