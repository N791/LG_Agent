import { Controller, Post, Get, Body, Query, Request, UseGuards } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryLog, TelemetryMetric } from './interfaces/telemetry-provider.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

class TelemetryBatchDto {
  logs: TelemetryLog[] = [];
  metrics: TelemetryMetric[] = [];
}

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post()
  @RequirePermission(PERMISSIONS.PROFILE_READ)
  async recordTelemetry(@Body() batch: TelemetryBatchDto) {
    // Optionally we can extract userId from JWT if logged in,
    // but the frontend can also provide it in the payload if needed.
    await this.telemetryService.processBatch(batch.logs, batch.metrics);
    return { success: true };
  }

  // Optionally protected by admin roles
  @UseGuards(JwtAuthGuard)
  @RequirePermission(PERMISSIONS.OBSERVABILITY_READ)
  @Get('logs')
  async getLogs(@Request() request: { user: TenantActor }, @Query('limit') limit?: string) {
    return this.telemetryService.getRecentLogs(
      request.user.organizationId,
      limit ? parseInt(limit, 10) : 100,
    );
  }

  @UseGuards(JwtAuthGuard)
  @RequirePermission(PERMISSIONS.OBSERVABILITY_READ)
  @Get('metrics')
  async getMetrics(@Request() request: { user: TenantActor }, @Query('limit') limit?: string) {
    return this.telemetryService.getRecentMetrics(
      request.user.organizationId,
      limit ? parseInt(limit, 10) : 100,
    );
  }
}
