import { Controller, Get, Query, Request } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Controller('analytics')
@RequirePermission(PERMISSIONS.ANALYTICS_READ)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('funnel')
  async getRampUpFunnel(
    @Request() request: { user: TenantActor },
    @Query('courseId') courseId: string,
  ) {
    return this.analyticsService.getRampUpFunnel(request.user, courseId);
  }

  @Get('bottlenecks')
  async getTopBottlenecks(
    @Request() request: { user: TenantActor },
    @Query('courseId') courseId: string,
  ) {
    return this.analyticsService.getTopBottlenecks(request.user, courseId);
  }

  @Get('performance')
  async getPerformanceStats(
    @Request() request: { user: TenantActor },
    @Query('courseId') courseId: string,
  ) {
    return this.analyticsService.getPerformanceStats(request.user, courseId);
  }
}
