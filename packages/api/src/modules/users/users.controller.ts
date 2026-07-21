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
import { Roles } from '../auth/decorators/roles.decorator';
import * as bcrypt from 'bcryptjs';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly userPreferenceService: UserPreferenceService,
  ) {}

  // ---- Self-service profile endpoints (any authenticated user) ----

  @Get('me')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async getProfile(@Request() req: { user: { id: string } }) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new BadRequestException('errors.auth.userNotFound');
    const { password: _pw, ...profile } = user;
    return profile;
  }

  @Patch('me')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async updateProfile(
    @Request() req: { user: { id: string } },
    @Body() body: { nickname?: string; email?: string },
  ) {
    const data: Prisma.UserUncheckedUpdateInput = {};
    if (body.nickname !== undefined) data.nickname = body.nickname;
    if (body.email !== undefined) data.email = body.email;
    const user = await this.usersService.update(req.user.id, data);
    const { password: _pw, ...profile } = user;
    return profile;
  }

  @Post('me/change-password')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async changePassword(
    @Request() req: { user: { id: string } },
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new BadRequestException('errors.auth.userNotFound');

    const isMatch = await bcrypt.compare(body.currentPassword, user.password);
    if (!isMatch) throw new BadRequestException('errors.auth.passwordIncorrect');

    const hashedPassword = await bcrypt.hash(body.newPassword, 10);
    await this.usersService.update(req.user.id, { password: hashedPassword });
    return { success: true };
  }

  @Get('me/preferences')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async getPreferences(@Request() req: { user: { id: string } }) {
    return this.userPreferenceService.getAll(req.user.id);
  }

  @Put('me/preferences/:key')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async setPreference(
    @Request() req: { user: { id: string } },
    @Param('key') key: string,
    @Body() body: { value: string },
  ) {
    return this.userPreferenceService.set(req.user.id, key, body.value);
  }

  // ---- Admin CRUD endpoints ----

  @Post()
  @Roles('ADMIN')
  async create(@Body() createUserDto: Prisma.UserUncheckedCreateInput) {
    if (createUserDto.password) {
      createUserDto.password = await bcrypt.hash(createUserDto.password, 10);
    }
    return this.usersService.create(createUserDto);
  }

  @Get()
  @Roles('ADMIN')
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles('ADMIN')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles('ADMIN')
  async update(@Param('id') id: string, @Body() updateUserDto: Prisma.UserUncheckedUpdateInput) {
    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password as string, 10);
    }
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
