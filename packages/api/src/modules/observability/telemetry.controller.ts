import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryLog, TelemetryMetric } from './interfaces/telemetry-provider.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class TelemetryBatchDto {
  logs: TelemetryLog[] = [];
  metrics: TelemetryMetric[] = [];
}

@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly telemetryService: TelemetryService) {}

  @Post()
  async recordTelemetry(@Body() batch: TelemetryBatchDto) {
    // Optionally we can extract userId from JWT if logged in,
    // but the frontend can also provide it in the payload if needed.
    await this.telemetryService.processBatch(batch.logs, batch.metrics);
    return { success: true };
  }

  // Optionally protected by admin roles
  @UseGuards(JwtAuthGuard)
  @Get('logs')
  async getLogs(@Query('limit') limit?: string) {
    return this.telemetryService.getRecentLogs(limit ? parseInt(limit, 10) : 100);
  }

  @UseGuards(JwtAuthGuard)
  @Get('metrics')
  async getMetrics(@Query('limit') limit?: string) {
    return this.telemetryService.getRecentMetrics(limit ? parseInt(limit, 10) : 100);
  }
}
