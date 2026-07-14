import { Controller, Post, Get, Body, Request, UseGuards } from '@nestjs/common';
import { TrainingService } from './training.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('training')
@UseGuards(JwtAuthGuard)
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post('submit')
  @Roles('TRAINEE', 'ADMIN', 'MENTOR')
  async submit(
    @Request() req: { user: { id: string } },
    @Body() body: { taskId: string; code: string },
  ) {
    const userId = req.user.id;
    return this.trainingService.submitTask(body.taskId, userId, body.code);
  }

  // Placeholder for Resume Learning capability (Epic 38)
  @Get('resume-learning')
  @Roles('TRAINEE')
  resumeLearning() {
    // Return a mock last accessed workspace/task context
    return {
      message: 'Resume learning capability placeholder',
      lastTaskId: 'task-1', // Default mock task
      lastAccessTime: new Date().toISOString(),
      action: 'CONTINUE', // or 'RESTART'
    };
  }
}
