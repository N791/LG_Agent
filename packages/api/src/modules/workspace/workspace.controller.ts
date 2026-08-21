import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { AuthoringWorkspaceService } from './authoring-workspace.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateWorkspaceVersionRequestDTO,
  InitWorkspaceRequestDTO,
  UpdateWorkspaceFilesRequestDTO,
  WorkspaceDTO,
  WorkspaceVersionDTO,
  PERMISSIONS,
} from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';

@Controller('workspaces')
@UseGuards(JwtAuthGuard)
@RequirePermission(PERMISSIONS.WORKSPACE_USE)
export class WorkspaceController {
  constructor(private readonly workspaceService: AuthoringWorkspaceService) {}

  @Post('init')
  async initWorkspace(
    @Body() body: InitWorkspaceRequestDTO,
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
    @Body() body: UpdateWorkspaceFilesRequestDTO,
    @Request() req: { user: { id: string } },
  ): Promise<WorkspaceDTO> {
    return this.workspaceService.updateFiles(taskId, req.user.id, body.files);
  }

  @Delete(':taskId/files')
  async deleteFile(
    @Param('taskId') taskId: string,
    @Query('path') path: string,
    @Request() req: { user: { id: string } },
  ): Promise<WorkspaceDTO> {
    return this.workspaceService.deleteFile(taskId, req.user.id, path);
  }

  @Post(':taskId/versions')
  async createVersion(
    @Param('taskId') taskId: string,
    @Body() body: CreateWorkspaceVersionRequestDTO,
    @Request() req: { user: { id: string } },
  ): Promise<WorkspaceVersionDTO> {
    return this.workspaceService.createVersion(taskId, req.user.id, body.trigger);
  }

  @Get(':taskId/versions')
  async getVersions(
    @Param('taskId') taskId: string,
    @Request() req: { user: { id: string } },
  ): Promise<WorkspaceVersionDTO[]> {
    return this.workspaceService.getVersions(taskId, req.user.id);
  }

  @Post(':taskId/versions/:versionId/restore')
  async restoreVersion(
    @Param('taskId') taskId: string,
    @Param('versionId') versionId: string,
    @Request() req: { user: { id: string } },
  ): Promise<WorkspaceDTO> {
    return this.workspaceService.restoreVersion(taskId, req.user.id, versionId);
  }
}
