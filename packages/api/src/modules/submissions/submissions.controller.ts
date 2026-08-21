import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Res,
  Req,
  Headers,
  HttpCode,
} from '@nestjs/common';
import { SubmissionsService } from './submissions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { Response } from 'express';
import { PERMISSIONS, RunSubmissionRequestDTO } from '@lg-agent/contracts';
import { RequireAnyPermission, RequirePermission } from '../authorization';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { endSse, initializeSse, writeSseEvent } from '../../common/sse';

interface AuthenticatedRequest {
  user: TenantActor;
}

@Controller('submissions')
@UseGuards(JwtAuthGuard)
export class SubmissionsController {
  constructor(private readonly submissionsService: SubmissionsService) {}

  @Get()
  @RequireAnyPermission(PERMISSIONS.SUBMISSION_READ, PERMISSIONS.SUBMISSION_MANAGE)
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('userId') userId?: string,
    @Query('courseId') courseId?: string,
    @Query('taskId') taskId?: string,
  ) {
    return this.submissionsService.findAll(req.user, { userId, courseId, taskId });
  }

  @Get(':id')
  @RequireAnyPermission(PERMISSIONS.SUBMISSION_READ, PERMISSIONS.SUBMISSION_MANAGE)
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.submissionsService.findOne(id, req.user);
  }

  @Post('run')
  @RequirePermission(PERMISSIONS.SUBMISSION_CREATE)
  async runSubmission(@Body() body: RunSubmissionRequestDTO, @Req() req: AuthenticatedRequest) {
    return this.submissionsService.submitTask(req.user, body.taskId, body.idempotencyKey);
  }

  @Get(':id/logs')
  @RequireAnyPermission(PERMISSIONS.SUBMISSION_READ, PERMISSIONS.SUBMISSION_MANAGE)
  async streamLogs(
    @Param('id') id: string,
    @Req() req: import('express').Request & AuthenticatedRequest,
    @Res() res: Response,
    @Headers('last-event-id') lastEventId?: string,
  ) {
    const parsedLastEventId = Number.parseInt(lastEventId ?? '0', 10);
    const stream = await this.submissionsService.streamSubmissionLogs(
      id,
      req.user,
      Number.isFinite(parsedLastEventId) ? parsedLastEventId : 0,
    );

    initializeSse(res);

    const subscription = stream.subscribe({
      next: (event) => {
        writeSseEvent(res, event, event.sequence);
      },
      error: (err: unknown) => {
        writeSseEvent(res, { type: 'ERROR', message: (err as Error).message });
        endSse(res);
      },
      complete: () => {
        endSse(res);
      },
    });

    req.on('close', () => {
      subscription.unsubscribe();
    });
  }

  @Post(':id/cancel')
  @RequirePermission(PERMISSIONS.SUBMISSION_CREATE)
  @HttpCode(204)
  cancel(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.submissionsService.cancelSubmission(id, req.user);
  }

  @Post(':id/replay')
  @RequirePermission(PERMISSIONS.SUBMISSION_MANAGE)
  @HttpCode(202)
  replay(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.submissionsService.replaySubmission(id, req.user);
  }
}
