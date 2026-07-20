import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserPreferenceService } from './user-preference.service';

import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserPreferenceService],
  exports: [UsersService, UserPreferenceService],
})
export class UsersModule {}
