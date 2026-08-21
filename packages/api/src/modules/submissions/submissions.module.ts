import { Module } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { PrismaModule } from '../../common/prisma.module';
import { SandboxModule } from '../sandbox';
import { WorkspaceModule } from '../workspace';
import { AiModule, AutoAIReviewPolicy } from '../ai';
import { EXECUTION_EVENT_BUS } from './interfaces/execution-event-bus.interface';
import { DurableExecutionEventBus } from './services/durable-execution-event-bus';
import { ExecutionRecoveryService } from './services/execution-recovery.service';
import { EXECUTION_ADAPTER } from './interfaces/execution-adapter.interface';
import { DatabaseExecutionAdapter } from './services/database-execution.adapter';
import { InProcessExecutionAdapter } from './services/in-process-execution.adapter';

import { AchievementModule } from '../achievements';
import { SUBMISSION_TERMINAL_HOOKS } from './interfaces/submission-terminal-hook.interface';
import {
  AchievementTerminalHook,
  AiReviewTerminalHook,
  NotificationTerminalHook,
} from './services/submission-terminal-hooks';

@Module({
  imports: [PrismaModule, SandboxModule, WorkspaceModule, AiModule, AchievementModule],
  controllers: [SubmissionsController],
  providers: [
    SubmissionsService,
    ExecutionRecoveryService,
    DurableExecutionEventBus,
    DatabaseExecutionAdapter,
    InProcessExecutionAdapter,
    {
      provide: EXECUTION_EVENT_BUS,
      useExisting: DurableExecutionEventBus,
    },
    {
      provide: EXECUTION_ADAPTER,
      useExisting: DatabaseExecutionAdapter,
    },
    {
      provide: 'IAIReviewPolicy',
      useClass: AutoAIReviewPolicy,
    },
    AchievementTerminalHook,
    NotificationTerminalHook,
    AiReviewTerminalHook,
    {
      provide: SUBMISSION_TERMINAL_HOOKS,
      useFactory: (
        achievements: AchievementTerminalHook,
        notifications: NotificationTerminalHook,
        aiReview: AiReviewTerminalHook,
      ) => [achievements, notifications, aiReview],
      inject: [AchievementTerminalHook, NotificationTerminalHook, AiReviewTerminalHook],
    },
  ],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
