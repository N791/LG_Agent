import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { LoggingModule } from './logging/logging.module';
import { MonitoringModule } from './monitoring/monitoring.module';

@Module({
  imports: [HealthModule, LoggingModule, MonitoringModule],
  exports: [HealthModule, LoggingModule, MonitoringModule],
})
export class PlatformModule {}
