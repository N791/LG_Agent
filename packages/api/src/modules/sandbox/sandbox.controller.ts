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
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { SandboxService } from './sandbox.service';
import { ExecutionManager } from './execution.manager';
import { WorkspaceService } from '../workspace/workspace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { ExecutionResponseDTO, ExecuteSandboxDTO } from '@lg-agent/contracts';
import type { Response } from 'express';
import { randomUUID } from 'crypto';

@Controller('sandbox')
@UseGuards(JwtAuthGuard)
export class SandboxController {
  private readonly logger = new Logger(SandboxController.name);

  constructor(
    private readonly sandboxService: SandboxService,
    private readonly executionManager: ExecutionManager,
    private readonly workspaceService: WorkspaceService,
  ) {}

  @Post('execute')
  execute(
    @Body() body: ExecuteSandboxDTO,
    @Req() req: { user?: { id?: string; sub?: string } },
  ): ExecutionResponseDTO {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new NotFoundException('User not found');
    }

    const executionId = randomUUID();
    this.logger.log(
      `Generated executionId ${executionId} for task ${body.taskId} action ${body.action}`,
    );
    return { executionId };
  }

  @Get('executions/:executionId/logs')
  async streamLogs(
    @Param('executionId') executionId: string,
    @Req() req: { user?: { id?: string; sub?: string }; query?: Record<string, unknown> },
    @Res() res: Response,
  ) {
    const userId = req.user?.id ?? req.user?.sub;
    if (!userId) {
      res.status(401).send('Unauthorized');
      return;
    }

    // Since SSE uses GET, we pass taskId and action via query parameters
    const taskId = req.query?.['taskId'] as string;
    const action = req.query?.['action'] as import('@lg-agent/contracts').SandboxAction;

    if (!taskId) {
      res.status(400).send('Missing taskId');
      return;
    }

    const workspaceDto = await this.workspaceService.getWorkspace(taskId, userId);
    const stream = this.sandboxService.runTask(taskId, userId, workspaceDto, {
      action,
      executionId,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      for await (const event of stream) {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err: unknown) {
      res.write(
        `data: ${JSON.stringify({ type: 'ERROR', message: (err as Error).message, timestamp: new Date().toISOString() })}\n\n`,
      );
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }

  @Post('executions/:executionId/stop')
  @HttpCode(204)
  stopExecution(@Param('executionId') executionId: string) {
    this.executionManager.stop(executionId);
  }
}
