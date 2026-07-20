import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { SandboxModule } from '../sandbox/sandbox.module';
import { ScoreCalculator } from './score.calculator';
import { PrismaModule } from '../../common/prisma.module';
import { CourseProgressService } from './course-progress.service';
import { LearningStatisticsService } from './learning-statistics.service';

@Module({
  imports: [SandboxModule, PrismaModule],
  controllers: [TrainingController],
  providers: [TrainingService, ScoreCalculator, CourseProgressService, LearningStatisticsService],
  exports: [TrainingService, ScoreCalculator, CourseProgressService, LearningStatisticsService],
})
export class TrainingModule {}
