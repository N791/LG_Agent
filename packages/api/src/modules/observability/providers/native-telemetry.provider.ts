import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { Prisma } from '@prisma/client';
import {
  TelemetryProvider,
  TelemetryLog,
  TelemetryMetric,
} from '../interfaces/telemetry-provider.interface';

@Injectable()
export class NativeTelemetryProvider implements TelemetryProvider {
  private readonly logger = new Logger(NativeTelemetryProvider.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordLog(log: TelemetryLog): Promise<void> {
    try {
      await this.prisma.clientLog.create({
        data: {
          level: log.level,
          message: log.message,
          stack: log.stack,
          path: log.path,
          userAgent: log.userAgent,
          userId: log.userId,
          metadata: (log.metadata ?? {}) as Prisma.InputJsonValue,
          createdAt: log.timestamp ?? new Date(),
        },
      });
    } catch (err) {
      this.logger.error('Failed to record client log', err);
    }
  }

  async recordMetric(metric: TelemetryMetric): Promise<void> {
    try {
      await this.prisma.clientMetric.create({
        data: {
          name: metric.name,
          value: metric.value,
          rating: metric.rating,
          path: metric.path,
          userAgent: metric.userAgent,
          userId: metric.userId,
          metadata: (metric.metadata ?? {}) as Prisma.InputJsonValue,
          createdAt: metric.timestamp ?? new Date(),
        },
      });
    } catch (err) {
      this.logger.error('Failed to record client metric', err);
    }
  }

  async recordBatch(logs: TelemetryLog[], metrics: TelemetryMetric[]): Promise<void> {
    try {
      if (logs.length > 0) {
        await this.prisma.clientLog.createMany({
          data: logs.map((log) => ({
            level: log.level,
            message: log.message,
            stack: log.stack,
            path: log.path,
            userAgent: log.userAgent,
            userId: log.userId,
            metadata: (log.metadata ?? {}) as Prisma.InputJsonValue,
            createdAt: log.timestamp ?? new Date(),
          })),
          skipDuplicates: true,
        });
      }

      if (metrics.length > 0) {
        await this.prisma.clientMetric.createMany({
          data: metrics.map((metric) => ({
            name: metric.name,
            value: metric.value,
            rating: metric.rating,
            path: metric.path,
            userAgent: metric.userAgent,
            userId: metric.userId,
            metadata: (metric.metadata ?? {}) as Prisma.InputJsonValue,
            createdAt: metric.timestamp ?? new Date(),
          })),
          skipDuplicates: true,
        });
      }
    } catch (err) {
      this.logger.error('Failed to record telemetry batch', err);
    }
  }
}
