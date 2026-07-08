import { Controller, Post, Body, Request, UseGuards } from '@nestjs/common';
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
}
