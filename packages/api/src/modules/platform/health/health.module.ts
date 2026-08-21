import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PrismaModule } from '../../../common/prisma.module';
import { AuthorizationModule } from '../../authorization';

@Module({
  imports: [TerminusModule, PrismaModule, AuthorizationModule],
  controllers: [HealthController],
})
export class HealthModule {}
