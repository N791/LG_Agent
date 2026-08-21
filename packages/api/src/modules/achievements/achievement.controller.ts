import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AchievementService } from './achievement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import { AchievementDTO } from '@lg-agent/contracts';

@Controller('achievements')
@UseGuards(JwtAuthGuard)
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get('me')
  @RequirePermission(PERMISSIONS.ACHIEVEMENT_READ)
  async getMyAchievements(@Request() req: { user: { id: string } }): Promise<AchievementDTO> {
    return this.achievementService.getUserAchievements(req.user.id);
  }
}
