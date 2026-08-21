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
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import { TogglePreferenceRequestDTO } from '@lg-agent/contracts';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
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
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  async getUnreadCount(@Request() req: { user: { id: string } }) {
    const count = await this.notificationService.getUnreadCount(req.user.id);
    return { count };
  }

  @Patch(':id/read')
  @RequirePermission(PERMISSIONS.NOTIFICATION_UPDATE)
  async markAsRead(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    await this.notificationService.markAsRead(req.user.id, id);
    return { success: true };
  }

  @Patch('read-all')
  @RequirePermission(PERMISSIONS.NOTIFICATION_UPDATE)
  async markAllAsRead(@Request() req: { user: { id: string } }) {
    await this.notificationService.markAllAsRead(req.user.id);
    return { success: true };
  }

  @Patch(':id/archive')
  @RequirePermission(PERMISSIONS.NOTIFICATION_UPDATE)
  async archive(@Request() req: { user: { id: string } }, @Param('id') id: string) {
    await this.notificationService.archive(req.user.id, id);
    return { success: true };
  }

  @Get('preferences')
  @RequirePermission(PERMISSIONS.NOTIFICATION_READ)
  async getPreferences(@Request() req: { user: { id: string } }) {
    return this.notificationService.getPreferences(req.user.id);
  }

  @Put('preferences/:type')
  @RequirePermission(PERMISSIONS.NOTIFICATION_UPDATE)
  async updatePreference(
    @Request() req: { user: { id: string } },
    @Param('type') type: string,
    @Body() body: TogglePreferenceRequestDTO,
  ) {
    return this.notificationService.updatePreference(req.user.id, type, body.enabled);
  }
}
