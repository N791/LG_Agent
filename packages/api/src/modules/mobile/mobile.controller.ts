import { BadRequestException, Controller, Get, Param, Query, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MobileTaskStatus, PERMISSIONS } from '@lg-agent/contracts';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { RequirePermission } from '../authorization';
import { MobileReadModelService } from './mobile-read-model.service';

interface AuthenticatedRequest {
  user: TenantActor;
}

@ApiTags('Mobile')
@Controller('mobile')
@RequirePermission(PERMISSIONS.TASK_READ, PERMISSIONS.TRAINING_READ)
export class MobileController {
  constructor(private readonly readModel: MobileReadModelService) {}

  @Get('home')
  @ApiOperation({ summary: 'Get the trainee mobile ten-second home view' })
  getHome(@Req() request: AuthenticatedRequest) {
    return this.readModel.getHome(request.user);
  }

  @Get('tasks')
  @ApiOperation({ summary: 'Get authorized mobile task summaries' })
  getTasks(
    @Req() request: AuthenticatedRequest,
    @Query('cursor') cursor?: string,
    @Query('limit') rawLimit?: string,
    @Query('status') rawStatus?: string,
  ) {
    const parsedLimit = rawLimit === undefined ? 20 : Number.parseInt(rawLimit, 10);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
      throw new BadRequestException('errors.mobile.invalidLimit');
    }
    const status = rawStatus as MobileTaskStatus | undefined;
    if (status && !Object.values(MobileTaskStatus).includes(status)) {
      throw new BadRequestException('errors.mobile.invalidStatus');
    }
    return this.readModel.getTasks(request.user, { cursor, limit: parsedLimit, status });
  }

  @Get('tasks/:taskId')
  @ApiOperation({ summary: 'Get an authorized mobile task detail' })
  getTask(@Req() request: AuthenticatedRequest, @Param('taskId') taskId: string) {
    return this.readModel.getTask(request.user, taskId);
  }

  @Get('submissions/:submissionId/summary')
  @RequirePermission(PERMISSIONS.SUBMISSION_READ)
  @ApiOperation({ summary: 'Get a redacted mobile submission conclusion, cause, and actions' })
  getSubmissionSummary(
    @Req() request: AuthenticatedRequest,
    @Param('submissionId') submissionId: string,
  ) {
    return this.readModel.getSubmissionSummary(request.user, submissionId);
  }
}
