import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  HttpCode,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { SandboxFacade } from './sandbox.facade';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExecuteSandboxDTO, PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import type { ExecutionResponseDTO } from '@lg-agent/contracts';
import type { Response } from 'express';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { endSse, initializeSse, writeSseEvent } from '../../common/sse';

@Controller('sandbox')
@UseGuards(JwtAuthGuard)
@RequirePermission(PERMISSIONS.SANDBOX_EXECUTE)
export class SandboxController {
  private readonly logger = new Logger(SandboxController.name);

  constructor(private readonly sandbox: SandboxFacade) {}

  @Post('execute')
  async execute(
    @Body() body: ExecuteSandboxDTO,
    @Req() req: { user: TenantActor },
  ): Promise<ExecutionResponseDTO> {
    const executionId = await this.sandbox.reserve(req.user, body.taskId, body.action);
    this.logger.log(
      `Generated executionId ${executionId} for task ${body.taskId} action ${body.action}`,
    );
    return { executionId };
  }

  @Get('executions/:executionId/logs')
  async streamLogs(
    @Param('executionId') executionId: string,
    @Req() req: { user: TenantActor; query?: Record<string, unknown> },
    @Res() res: Response,
  ) {
    // Since SSE uses GET, we pass taskId and action via query parameters
    const taskId = req.query?.['taskId'] as string;
    const action = req.query?.['action'] as import('@lg-agent/contracts').SandboxAction;

    if (!taskId) {
      throw new BadRequestException('Missing taskId');
    }

    const stream = await this.sandbox.run(executionId, req.user, taskId, action);

    initializeSse(res);

    try {
      for await (const event of stream) {
        writeSseEvent(res, event);
      }
      endSse(res);
    } catch (err: unknown) {
      writeSseEvent(res, { type: 'ERROR', message: (err as Error).message });
      endSse(res);
    } finally {
      this.sandbox.release(executionId);
    }
  }

  @Post('executions/:executionId/stop')
  @HttpCode(204)
  stopExecution(@Param('executionId') executionId: string, @Req() req: { user: TenantActor }) {
    this.sandbox.stop(executionId, req.user);
  }
}
