import { Module, forwardRef } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { SubmissionsController } from './submissions.controller';
import { PrismaModule } from '../../common/prisma.module';
import { SandboxModule } from '../sandbox/sandbox.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { AiModule } from '../ai/ai.module';
import { EXECUTION_EVENT_BUS } from './interfaces/execution-event-bus.interface';
import { InMemoryExecutionEventBus } from './services/in-memory-execution-event-bus';
import { ExecutionRecoveryService } from './services/execution-recovery.service';

import { AutoAIReviewPolicy } from '../ai/tutor/ai-review.policy';
import { AchievementModule } from '../achievements/achievement.module';

@Module({
  imports: [PrismaModule, SandboxModule, WorkspaceModule, forwardRef(() => AiModule), AchievementModule],
  controllers: [SubmissionsController],
  providers: [
    SubmissionsService,
    ExecutionRecoveryService,
    {
      provide: EXECUTION_EVENT_BUS,
      useClass: InMemoryExecutionEventBus,
    },
    {
      provide: 'IAIReviewPolicy',
      useClass: AutoAIReviewPolicy,
    }
  ],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
