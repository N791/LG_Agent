import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { DiscussionsService } from './discussions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  AddDiscussionCommentRequestDTO,
  AssignDiscussionRequestDTO,
  CreateDiscussionRequestDTO,
  UpdateDiscussionStatusRequestDTO,
} from '@lg-agent/contracts';
import type { DiscussionDTO, DiscussionAnalyticsDTO } from '@lg-agent/contracts';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequireAnyPermission, RequirePermission } from '../authorization';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Controller('discussions')
@UseGuards(JwtAuthGuard)
export class DiscussionsController {
  constructor(private readonly discussionsService: DiscussionsService) {}

  @Post()
  @RequirePermission(PERMISSIONS.DISCUSSION_CREATE)
  async createDiscussion(
    @Request() req: { user: TenantActor },
    @Body() dto: CreateDiscussionRequestDTO,
  ): Promise<DiscussionDTO> {
    return this.discussionsService.createDiscussion(req.user, dto);
  }

  @Get()
  @RequirePermission(PERMISSIONS.DISCUSSION_READ)
  async getDiscussions(
    @Request() req: { user: TenantActor },
    @Query('taskId') taskId?: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<DiscussionDTO[]> {
    return this.discussionsService.getDiscussions(req.user, taskId, workspaceId);
  }

  @Get('analytics')
  @RequirePermission(PERMISSIONS.DISCUSSION_MANAGE)
  async getAnalytics(@Request() req: { user: TenantActor }): Promise<DiscussionAnalyticsDTO> {
    return this.discussionsService.getDiscussionAnalytics(req.user);
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.DISCUSSION_READ)
  async getDiscussionDetails(
    @Request() req: { user: TenantActor },
    @Param('id') id: string,
  ): Promise<DiscussionDTO> {
    return this.discussionsService.getDiscussionDetails(id, req.user);
  }

  @Post(':id/comments')
  @RequirePermission(PERMISSIONS.DISCUSSION_CREATE)
  async addComment(
    @Request() req: { user: TenantActor },
    @Param('id') id: string,
    @Body() dto: AddDiscussionCommentRequestDTO,
  ): Promise<DiscussionDTO> {
    return this.discussionsService.addComment(id, req.user, dto);
  }

  @Patch(':id/status')
  @RequireAnyPermission(PERMISSIONS.DISCUSSION_CREATE, PERMISSIONS.DISCUSSION_MANAGE)
  async updateStatus(
    @Request() req: { user: TenantActor },
    @Param('id') id: string,
    @Body() dto: UpdateDiscussionStatusRequestDTO,
  ): Promise<DiscussionDTO> {
    return this.discussionsService.updateDiscussionStatus(id, dto.status, req.user);
  }

  @Post(':id/assign')
  @RequirePermission(PERMISSIONS.DISCUSSION_MANAGE)
  async assignDiscussion(
    @Request() req: { user: TenantActor },
    @Param('id') id: string,
    @Body() dto: AssignDiscussionRequestDTO,
  ): Promise<DiscussionDTO> {
    return this.discussionsService.assignDiscussion(id, dto.assignedToId, req.user);
  }

  @Post(':id/resolve')
  @RequireAnyPermission(PERMISSIONS.DISCUSSION_CREATE, PERMISSIONS.DISCUSSION_MANAGE)
  async resolveDiscussion(
    @Request() req: { user: TenantActor },
    @Param('id') id: string,
  ): Promise<DiscussionDTO> {
    return this.discussionsService.resolveDiscussion(id, req.user);
  }
}
