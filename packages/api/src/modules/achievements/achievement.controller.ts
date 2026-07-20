import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { AchievementService } from './achievement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AchievementDTO } from '@lg-agent/contracts';

@Controller('achievements')
@UseGuards(JwtAuthGuard)
export class AchievementController {
  constructor(private readonly achievementService: AchievementService) {}

  @Get('me')
  @Roles('TRAINEE')
  async getMyAchievements(@Request() req: { user: { id: string } }): Promise<AchievementDTO> {
    return this.achievementService.getUserAchievements(req.user.id);
  }
}
