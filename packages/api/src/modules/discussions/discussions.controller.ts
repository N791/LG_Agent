/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { DiscussionsService } from './discussions.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { DiscussionDTO, DiscussionAnalyticsDTO } from '@lg-agent/contracts';

@Controller('discussions')
@UseGuards(JwtAuthGuard)
export class DiscussionsController {
  constructor(private readonly discussionsService: DiscussionsService) {}

  @Post()
  async createDiscussion(@Request() req: any, @Body() dto: any): Promise<DiscussionDTO> {
    return this.discussionsService.createDiscussion(req.user, dto);
  }

  @Get()
  async getDiscussions(
    @Request() req: any,
    @Query('taskId') taskId?: string,
    @Query('workspaceId') workspaceId?: string,
  ): Promise<DiscussionDTO[]> {
    return this.discussionsService.getDiscussions(req.user.id, taskId, workspaceId);
  }

  @Get(':id')
  async getDiscussionDetails(@Param('id') id: string): Promise<DiscussionDTO> {
    return this.discussionsService.getDiscussionDetails(id);
  }

  @Post(':id/comments')
  async addComment(@Request() req: any, @Param('id') id: string, @Body() dto: any): Promise<DiscussionDTO> {
    return this.discussionsService.addComment(id, req.user, dto);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body() dto: any): Promise<DiscussionDTO> {
    return this.discussionsService.updateDiscussionStatus(id, dto.status);
  }

  @Post(':id/assign')
  async assignDiscussion(@Param('id') id: string, @Body() dto: any): Promise<DiscussionDTO> {
    return this.discussionsService.assignDiscussion(id, dto.assignedToId);
  }

  @Post(':id/resolve')
  async resolveDiscussion(@Param('id') id: string): Promise<DiscussionDTO> {
    return this.discussionsService.resolveDiscussion(id);
  }

  @Get('analytics')
  async getAnalytics(@Request() req: any): Promise<DiscussionAnalyticsDTO> {
    return this.discussionsService.getDiscussionAnalytics(req.user.id);
  }
}
