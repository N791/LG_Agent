import { Injectable, Inject } from '@nestjs/common';
import { TELEMETRY_PROVIDER } from './interfaces/telemetry-provider.interface';
import type {
  TelemetryProvider,
  TelemetryLog,
  TelemetryMetric,
} from './interfaces/telemetry-provider.interface';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class TelemetryService {
  constructor(
    @Inject(TELEMETRY_PROVIDER) private readonly provider: TelemetryProvider,
    private readonly prisma: PrismaService,
  ) {}

  async processBatch(logs: TelemetryLog[], metrics: TelemetryMetric[]): Promise<void> {
    await this.provider.recordBatch(logs, metrics);
  }

  async getRecentLogs(organizationId: string, limit = 100) {
    return this.prisma.clientLog.findMany({
      where: { user: { organizationId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { username: true, email: true } },
      },
    });
  }

  async getRecentMetrics(organizationId: string, limit = 100) {
    return this.prisma.clientMetric.findMany({
      where: { user: { organizationId } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { username: true, email: true } },
      },
    });
  }
}
