import { Module } from '@nestjs/common';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
import { SandboxModule } from '../sandbox/sandbox.module';
import { PrismaModule } from '../../common/prisma.module';
import { ScoreCalculator } from './score.calculator';

@Module({
  imports: [SandboxModule, PrismaModule],
  controllers: [TrainingController],
  providers: [TrainingService, ScoreCalculator],
})
export class TrainingModule {}
