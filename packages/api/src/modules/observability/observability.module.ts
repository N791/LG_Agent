import { Module } from '@nestjs/common';
import { TelemetryController } from './telemetry.controller';
import { AuditController } from './audit.controller';
import { TelemetryService } from './telemetry.service';
import { TELEMETRY_PROVIDER } from './interfaces/telemetry-provider.interface';
import { NativeTelemetryProvider } from './providers/native-telemetry.provider';
import { TRACING_PROVIDER } from './interfaces/tracing-provider.interface';
import { NativeTracingProvider } from './providers/native-tracing.provider';
import { METRICS_PROVIDER } from './interfaces/metrics-provider.interface';
import { NativeMetricsProvider } from './providers/native-metrics.provider';
import { LOGGING_PROVIDER } from './interfaces/logging-provider.interface';
import { NativeLoggingProvider } from './providers/native-logging.provider';
import { AUDIT_PROVIDER } from './interfaces/audit-provider.interface';
import { PrismaAuditProvider } from './providers/prisma-audit.provider';
import { ALERT_ENGINE, ALERT_CHANNEL } from './interfaces/alert-engine.interface';
import { NativeAlertEngine, NativeLogAlertChannel } from './providers/native-alert.engine';
import { MonitoringModule } from '../platform/monitoring/monitoring.module';

@Module({
  imports: [MonitoringModule],
  controllers: [TelemetryController, AuditController],
  providers: [
    TelemetryService,
    { provide: TELEMETRY_PROVIDER, useClass: NativeTelemetryProvider },
    { provide: TRACING_PROVIDER, useClass: NativeTracingProvider },
    { provide: METRICS_PROVIDER, useClass: NativeMetricsProvider },
    { provide: LOGGING_PROVIDER, useClass: NativeLoggingProvider },
    { provide: AUDIT_PROVIDER, useClass: PrismaAuditProvider },
    { provide: ALERT_CHANNEL, useClass: NativeLogAlertChannel },
    { provide: ALERT_ENGINE, useClass: NativeAlertEngine },
  ],
  exports: [
    TelemetryService,
    TRACING_PROVIDER,
    METRICS_PROVIDER,
    LOGGING_PROVIDER,
    AUDIT_PROVIDER,
    ALERT_ENGINE,
  ],
})
export class ObservabilityModule {}
