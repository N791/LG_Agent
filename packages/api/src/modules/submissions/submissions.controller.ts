import { Controller, Get, Post, Body, Param, Query, UseGuards, Res, Req } from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response } from 'express';

@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('courseId') courseId?: string,
    @Query('taskId') taskId?: string,
  ) {
    return this.submissionsService.findAll({ userId, courseId, taskId });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.submissionsService.findOne(id);
  }

  @Post('run')
  async runSubmission(
    @Body() body: { taskId: string },
    @Req() req: { user?: { id?: string; sub?: string } },
    @Res() res: Response,
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) {
      res.status(401).send('Unauthorized');
      return;
    }
    const result = await this.submissionsService.submitTask(userId, body.taskId);
    res.json(result);
  }

  @Get(':id/logs')
  async streamLogs(@Param('id') id: string, @Req() req: any, @Res() res: Response) {
    const stream = this.submissionsService.streamSubmissionLogs(id);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const subscription = stream.subscribe({
      next: (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
      error: (err: unknown) => {
        res.write(
          `data: ${JSON.stringify({ type: 'ERROR', message: (err as Error).message, timestamp: new Date().toISOString() })}\n\n`
        );
        res.write('data: [DONE]\n\n');
        res.end();
      },
      complete: () => {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    });

    req.on('close', () => {
      subscription.unsubscribe();
    });
  }
}
