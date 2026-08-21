import { Controller, Get, Request, UseGuards, Query, Param } from '@nestjs/common';
import { TrainingService } from './training.service';
import { CourseProgressService } from './course-progress.service';
import { LearningStatisticsService } from './learning-statistics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Controller('training')
@UseGuards(JwtAuthGuard)
@RequirePermission(PERMISSIONS.TRAINING_READ)
export class TrainingController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly courseProgressService: CourseProgressService,
    private readonly learningStatisticsService: LearningStatisticsService,
  ) {}

  @Get('my-courses')
  async getMyCourses(@Request() req: { user: TenantActor }) {
    return this.learningStatisticsService.getMyCourses(req.user);
  }

  @Get('statistics/me')
  async getOverallStatistics(@Request() req: { user: TenantActor }) {
    return this.learningStatisticsService.getOverallStatistics(req.user);
  }

  @Get('progress')
  async getProgress(@Request() req: { user: TenantActor }, @Query('courseId') courseId?: string) {
    return this.courseProgressService.getProgress(req.user, courseId);
  }

  @Get('timeline/:courseId')
  async getTimeline(@Request() req: { user: TenantActor }, @Param('courseId') courseId: string) {
    return this.trainingService.getTimeline(req.user, courseId);
  }

  @Get('recent')
  async getRecentLearning(@Request() req: { user: TenantActor }) {
    return this.trainingService.getRecentLearning(req.user);
  }
}
