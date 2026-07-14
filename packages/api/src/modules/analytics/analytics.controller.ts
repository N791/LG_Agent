import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('analytics')
@UseGuards(RolesGuard)
@Roles(Role.ADMIN, Role.MENTOR)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('funnel')
  async getRampUpFunnel(@Query('courseId') courseId: string) {
    return this.analyticsService.getRampUpFunnel(courseId);
  }

  @Get('bottlenecks')
  async getTopBottlenecks(@Query('courseId') courseId: string) {
    return this.analyticsService.getTopBottlenecks(courseId);
  }

  @Get('performance')
  async getPerformanceStats(@Query('courseId') courseId: string) {
    return this.analyticsService.getPerformanceStats(courseId);
  }
}
