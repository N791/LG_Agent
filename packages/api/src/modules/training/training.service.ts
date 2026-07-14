import { Injectable, Logger } from '@nestjs/common';
import { SandboxService } from '../sandbox/sandbox.service';
import { PrismaService } from '../../common/prisma.service';
import { ExecutionEventType } from '@lg-agent/contracts';

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    private sandboxService: SandboxService,
    private prisma: PrismaService,
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
      const stream = this.sandboxService.runTask(
        taskId,
        userId,
        {
          taskId,
          workspace: {
            entry: 'index.js',
            files: [{ path: 'index.js', content: code }],
          },
        },
        taskConfig,
      );

      const finalResult = { passed: false, totalScore: 0, logs: '', report: {} };

      for await (const event of stream) {
        if (event.type === ExecutionEventType.LOG) {
          finalResult.logs += (event.data as { text?: string }).text ?? '';
        } else if (
          event.type === ExecutionEventType.SUCCESS ||
          event.type === ExecutionEventType.FAILED
        ) {
          const data = event.data as
            { passed?: boolean; score?: number; report?: Record<string, unknown> } | undefined;
          finalResult.passed = data?.passed ?? false;
          finalResult.totalScore = data?.score ?? 0;
          finalResult.report = data?.report ?? {};
        } else if (event.type === ExecutionEventType.ERROR) {
          finalResult.logs += `\nError: ${event.message ?? 'Unknown'}`;
        }
      }

      // 6. Update submission
      const updated = await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: finalResult.passed ? 'PASSED' : 'FAILED',
          score: finalResult.totalScore,
          logs: finalResult.logs,
          report: finalResult.report, // Save detailed evaluation report
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
