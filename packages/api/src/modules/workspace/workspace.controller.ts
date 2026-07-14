import { Controller, Post, Get, Put, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WorkspaceDTO, WorkspaceFileDTO, WorkspaceVersionDTO } from '@lg-agent/contracts';

@Controller('v1/workspaces')
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post('init')
  async initWorkspace(
    @Body() body: { taskId: string },
    @Request() req: { user: { id: string } },
  ): Promise<WorkspaceDTO> {
    return this.workspaceService.initWorkspace(body.taskId, req.user.id);
  }

  @Get(':taskId')
  async getWorkspace(
    @Param('taskId') taskId: string,
    @Request() req: { user: { id: string } },
  ): Promise<WorkspaceDTO> {
    return this.workspaceService.getWorkspace(taskId, req.user.id);
  }

  @Put(':taskId/files')
  async updateFiles(
    @Param('taskId') taskId: string,
    @Body() body: { files: Pick<WorkspaceFileDTO, 'path' | 'content'>[] },
    @Request() req: { user: { id: string } },
  ): Promise<WorkspaceDTO> {
    return this.workspaceService.updateFiles(taskId, req.user.id, body.files);
  }

  @Post(':taskId/versions')
  async createVersion(
    @Param('taskId') taskId: string,
    @Body() body: { trigger: 'RUN' | 'SUBMIT' | 'MANUAL' },
    @Request() req: { user: { id: string } },
  ): Promise<WorkspaceVersionDTO> {
    return this.workspaceService.createVersion(taskId, req.user.id, body.trigger);
  }
}
