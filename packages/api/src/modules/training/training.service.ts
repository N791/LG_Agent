import { Injectable, Logger } from '@nestjs/common';
import { SandboxService } from '../sandbox/sandbox.service';
import { PrismaService } from '../../common/prisma.service';
import { ScoreCalculator } from './score.calculator';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    private sandboxService: SandboxService,
    private prisma: PrismaService,
    private scoreCalculator: ScoreCalculator,
  ) {}

  async submitTask(taskId: string, userId: string, code: string) {
    this.logger.log(`User ${userId} submitting task ${taskId}...`);

    // 1. Verify Task exists
    const task = await this.prisma.task.findUnique({ where: { id: taskId } });
    if (!task) {
      throw new Error('Task not found');
    }

    // 2. Create Submission (PENDING/RUNNING)
    const submission = await this.prisma.submission.create({
      data: {
        taskId,
        userId,
        status: 'RUNNING',
        score: 0,
      },
    });

    try {
      // 3. Fetch task config from DB
      const taskConfig = {
        testScript: (task.testConfig as { script?: string } | null)?.script ?? null,
        env: task.envConfig as import('../sandbox/env-detector.service').EnvRequirement | null,
      };

      // 4. Pass to SandboxEngine
      const result = await this.sandboxService.runTask(taskId, userId, code, taskConfig);

      // 5. Calculate detailed score
      const finalResult = this.scoreCalculator.calculate({
        testPassed: result.passed,
        compilePassed: result.passed,
        exitCode: result.report['exitCode'] as number | undefined,
        message: result.report['message'] as string | undefined,
      });

      // 6. Update submission
      const updated = await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: finalResult.passed ? 'PASSED' : 'FAILED',
          score: finalResult.totalScore,
          logs: result.logs,
          report: finalResult.details as import('@prisma/client').Prisma.InputJsonObject, // Save detailed evaluation report
        },
      });

      return updated;
    } catch (error: unknown) {
      this.logger.error(`Task execution failed: ${(error as Error).message}`);
      const updated = await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: 'ERROR',
          logs: (error as Error).message,
        },
      });
      return updated;
    }
  }
}
