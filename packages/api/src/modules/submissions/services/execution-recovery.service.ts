import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';

@Injectable()
export class ExecutionRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(ExecutionRecoveryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    this.logger.log('Scanning for orphaned submissions...');
    const result = await this.prisma.submission.updateMany({
      where: {
        status: {
          in: ['PENDING', 'RUNNING'],
        },
      },
      data: {
        status: 'FAILED',
        logs: 'Execution failed due to Server Restart.',
      },
    });

    if (result.count > 0) {
      this.logger.warn(`Recovered ${result.count.toString()} orphaned submission(s) and marked them as FAILED.`);
    } else {
      this.logger.log('No orphaned submissions found.');
    }
  }
}
