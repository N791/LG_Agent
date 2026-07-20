import {
  Controller,
  Get,
  Patch,
  Put,
  Query,
  Param,
  Body,
  Request,
  UseGuards,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async list(
    @Request() req: { user: { id: string } },
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.notificationService.getUserNotifications(req.user.id, {
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('unread-count')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async getUnreadCount(@Request() req: { user: { id: string } }) {
    const count = await this.notificationService.getUnreadCount(req.user.id);
    return { count };
  }

  @Patch(':id/read')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async markAsRead(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    await this.notificationService.markAsRead(req.user.id, id);
    return { success: true };
  }

  @Patch('read-all')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async markAllAsRead(@Request() req: { user: { id: string } }) {
    await this.notificationService.markAllAsRead(req.user.id);
    return { success: true };
  }

  @Patch(':id/archive')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async archive(
    @Request() req: { user: { id: string } },
    @Param('id') id: string,
  ) {
    await this.notificationService.archive(req.user.id, id);
    return { success: true };
  }

  @Get('preferences')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async getPreferences(@Request() req: { user: { id: string } }) {
    return this.notificationService.getPreferences(req.user.id);
  }

  @Put('preferences/:type')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async updatePreference(
    @Request() req: { user: { id: string } },
    @Param('type') type: string,
    @Body() body: { enabled: boolean },
  ) {
    return this.notificationService.updatePreference(
      req.user.id,
      type,
      body.enabled,
    );
  }
}
