import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SubmissionStatus } from '@lg-agent/contracts';
import { PrismaService } from '../../../common/prisma.service';
import { SubmissionsService } from '../submissions.service';

@Injectable()
export class ExecutionRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(ExecutionRecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly submissions: SubmissionsService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('Scanning for interrupted submissions...');
    const interrupted = await this.prisma.submission.findMany({
      where: {
        status: { in: [SubmissionStatus.PENDING, SubmissionStatus.RUNNING] },
      },
      select: {
        id: true,
        userId: true,
        taskId: true,
        status: true,
        executionOwner: true,
        leaseExpiresAt: true,
      },
    });

    const results = await Promise.allSettled(
      interrupted.map((submission) => this.submissions.recoverInterruptedSubmission(submission)),
    );
    const failures = results.filter((result) => result.status === 'rejected').length;
    if (interrupted.length > 0) {
      this.logger.warn(
        `Recovered ${String(interrupted.length - failures)} interrupted submission(s); ${String(failures)} failed.`,
      );
    } else {
      this.logger.log('No interrupted submissions found.');
    }
  }
}
