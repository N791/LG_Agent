import { Controller, Post, Get, Body, Request, UseGuards, Query, Param } from '@nestjs/common';
import { TrainingService } from './training.service';
import { CourseProgressService } from './course-progress.service';
import { LearningStatisticsService } from './learning-statistics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(
    private readonly trainingService: TrainingService,
    private readonly courseProgressService: CourseProgressService,
    private readonly learningStatisticsService: LearningStatisticsService,
  ) {}

  @Post('submit')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async submit(
    @Request() req: { user: { id: string } },
    @Body() body: { taskId: string; code: string },
  ) {
    const userId = req.user.id;
    return this.trainingService.submitTask(body.taskId, userId, body.code);
  }

  @Get('my-courses')
  @Roles('TRAINEE')
  async getMyCourses(@Request() req: { user: { id: string } }) {
    return this.learningStatisticsService.getMyCourses(req.user.id);
  }

  @Get('statistics/me')
  @Roles('TRAINEE')
  async getOverallStatistics(@Request() req: { user: { id: string } }) {
    return this.learningStatisticsService.getOverallStatistics(req.user.id);
  }

  @Get('progress')
  @Roles('TRAINEE')
  async getProgress(@Request() req: { user: { id: string } }, @Query('courseId') courseId?: string) {
    return this.courseProgressService.getProgress(req.user.id, courseId);
  }

  @Get('timeline/:courseId')
  @Roles('TRAINEE')
  async getTimeline(@Request() req: { user: { id: string } }, @Param('courseId') courseId: string) {
    return this.trainingService.getTimeline(req.user.id, courseId);
  }

  @Get('recent')
  @Roles('TRAINEE')
  async getRecentLearning(@Request() req: { user: { id: string } }) {
    return this.trainingService.getRecentLearning(req.user.id);
  }
}
