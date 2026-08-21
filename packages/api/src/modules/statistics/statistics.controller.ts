import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Controller('statistics')
@UseGuards(JwtAuthGuard)
@RequirePermission(PERMISSIONS.ANALYTICS_READ)
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('overview')
  async getOverview(@Request() request: { user: TenantActor }) {
    return this.statisticsService.getOverview(request.user);
  }

  @Get('trends')
  async getLearningTrends(@Request() request: { user: TenantActor }) {
    return this.statisticsService.getLearningTrends(request.user);
  }

  @Get('blockers')
  async getBlockers(@Request() request: { user: TenantActor }) {
    return this.statisticsService.getBlockers(request.user);
  }

  @Get('ai-usage')
  async getAiUsage(@Request() request: { user: TenantActor }) {
    return this.statisticsService.getAiUsage(request.user);
  }

  @Get('ai-audit')
  async getAiAudit(@Request() request: { user: TenantActor }) {
    return this.statisticsService.getAiAudit(request.user);
  }
}
