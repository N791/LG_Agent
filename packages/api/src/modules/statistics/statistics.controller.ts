import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('statistics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  async getOverview() {
    return this.statisticsService.getOverview();
  }

  @Get('trends')
  async getLearningTrends() {
    return this.statisticsService.getLearningTrends();
  }

  @Get('blockers')
  async getBlockers() {
    return this.statisticsService.getBlockers();
  }

  @Get('ai-usage')
  async getAiUsage() {
    return this.statisticsService.getAiUsage();
  }

  @Get('ai-audit')
  async getAiAudit() {
    return this.statisticsService.getAiAudit();
  }
}
