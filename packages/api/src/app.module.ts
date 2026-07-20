/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing */
import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { CoursesModule } from './modules/courses/courses.module';
import { ConfigModule } from '@nestjs/config';
import { configValidationSchema } from './config/env.validation';
import { TasksModule } from './modules/tasks/tasks.module';
import { SandboxModule } from './modules/sandbox/sandbox.module';
import { TrainingModule } from './modules/training/training.module';
import { AiModule } from './modules/ai/ai.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from './modules/auth/guards/roles.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { SchemasModule } from './modules/schemas/schemas.module';
import { SubmissionsModule } from './modules/submissions/submissions.module';
import { ReportsModule } from './modules/reports/reports.module';
import { PlatformModule } from './modules/platform/platform.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AchievementModule } from './modules/achievements/achievement.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { ObservabilityModule } from './modules/observability/observability.module';
import { ClsModule } from 'nestjs-cls';
import { randomUUID as uuidv4 } from 'crypto';
import { ScheduleModule } from '@nestjs/schedule';
import { DiscussionsModule } from './modules/discussions/discussions.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        setup: (cls, req) => {
          const traceId = req.headers['x-trace-id'] || uuidv4();
          const correlationId = req.headers['x-correlation-id'] || uuidv4();
          const reqId = req.headers['x-request-id'] || uuidv4();
          cls.set('traceId', traceId);
          cls.set('correlationId', correlationId);
          cls.set('reqId', reqId);
          
          // User and Org will be set by the AuthGuard later in the request lifecycle,
          // but we initialize them here if needed.
        },
      },
    }),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
    }),
    PrismaModule,
    OrganizationsModule,
    UsersModule,
    CoursesModule,
    TasksModule,
    SandboxModule,
    TrainingModule,
    AuthModule,
    AiModule,
    StatisticsModule,
    SchemasModule,
    SubmissionsModule,
    ReportsModule,
    PlatformModule,
    AnalyticsModule,
    AchievementModule,
    NotificationModule,
    DiscussionsModule,
    ObservabilityModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule {}
