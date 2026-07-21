/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/prefer-nullish-coalescing */
import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NOTIFICATION_PUBLISHER } from '../notifications/notification-publisher.interface';
import type { INotificationPublisher } from '../notifications/notification-publisher.interface';
import {
  CreateDiscussionDTO,
  AddCommentDTO,
  DiscussionDTO,
  NotificationType,
  DiscussionAnalyticsDTO,
} from '@lg-agent/contracts';
import { User } from '@prisma/client';

@Injectable()
export class DiscussionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PUBLISHER) private readonly notificationPublisher: INotificationPublisher,
  ) {}

  async createDiscussion(user: User, dto: CreateDiscussionDTO): Promise<DiscussionDTO> {
    const discussion = await this.prisma.discussion.create({
      data: {
        userId: user.id,
        taskId: dto.taskId,
        submissionId: dto.submissionId,
        workspaceId: dto.workspaceId,
        contextType: dto.contextType,
        title: dto.title,
        priority: dto.priority || 'NORMAL',
        comments: {
          create: {
            authorId: user.id,
            content: dto.initialComment,
            codeSnippet: dto.codeSnippet,
            filePath: dto.filePath,
            startLine: dto.startLine,
            endLine: dto.endLine,
            isInternal: dto.isInternal || false,
            mentions: dto.mentions || [],
          } as any,
        },
      },
      include: {
        user: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    await this.notificationPublisher.publish({
      userId: 'MENTORS',
      type: NotificationType.NEW_DISCUSSION,
      title: 'New Discussion',
      message: `${user.nickname || user.username} started a discussion: ${dto.title}`,
      payload: { discussionId: discussion.id, taskId: dto.taskId },
    });

    return this.mapDiscussion(discussion);
  }

  async getDiscussions(
    userId: string,
    taskId?: string,
    workspaceId?: string,
  ): Promise<DiscussionDTO[]> {
    const where: any = { userId };
    if (taskId) where.taskId = taskId;
    if (workspaceId) where.workspaceId = workspaceId;

    const discussions = await this.prisma.discussion.findMany({
      where,
      include: {
        user: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return discussions
      .map((d: any) => this.mapDiscussion(d))
      .sort((a, b) => {
        const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 } as Record<string, number>;
        const aRank = priorityRank[a.priority] ?? 2;
        const bRank = priorityRank[b.priority] ?? 2;
        if (aRank !== bRank) return aRank - bRank;

        const aAge = (Date.now() - new Date(a.updatedAt).getTime()) / 60000;
        const bAge = (Date.now() - new Date(b.updatedAt).getTime()) / 60000;
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        if (aAge !== bAge) return aAge - bAge;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }

  async getDiscussionDetails(id: string): Promise<DiscussionDTO> {
    const discussion = await this.prisma.discussion.findUnique({
      where: { id },
      include: {
        user: true,
        comments: {
          include: { author: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!discussion) throw new NotFoundException('errors.discussion.notFound');

    return this.mapDiscussion(discussion);
  }

  async addComment(id: string, author: User, dto: AddCommentDTO): Promise<DiscussionDTO> {
    const discussion = await this.prisma.discussion.findUnique({ where: { id } });
    if (!discussion) throw new NotFoundException('errors.discussion.notFound');

    await this.prisma.discussionComment.create({
      data: {
        discussionId: id,
        authorId: author.id,
        content: dto.content,
        codeSnippet: dto.codeSnippet,
        filePath: dto.filePath,
        startLine: dto.startLine,
        endLine: dto.endLine,
        isInternal: dto.isInternal || false,
        mentions: dto.mentions || [],
      } as any,
    });

    const nextStatus = discussion.status === 'CLOSED' ? 'OPEN' : discussion.status;
    await this.prisma.discussion.update({
      where: { id },
      data: {
        updatedAt: new Date(),
        status: nextStatus,
      },
    });

    if (author.id !== discussion.userId) {
      await this.notificationPublisher.publish({
        userId: discussion.userId,
        type: NotificationType.MENTOR_REPLY,
        title: 'New Reply',
        message: `${author.nickname || author.username} replied to your discussion.`,
        payload: { discussionId: id },
      });
    }

    return this.getDiscussionDetails(id);
  }

  async updateDiscussionStatus(id: string, status: string): Promise<DiscussionDTO> {
    await this.prisma.discussion.update({
      where: { id },
      data: { status },
    });
    return this.getDiscussionDetails(id);
  }

  async resolveDiscussion(id: string): Promise<DiscussionDTO> {
    await this.prisma.discussion.update({
      where: { id },
      data: { status: 'RESOLVED' },
    });
    return this.getDiscussionDetails(id);
  }

  async getDiscussionAnalytics(userId: string): Promise<DiscussionAnalyticsDTO> {
    const discussions = await this.prisma.discussion.findMany({
      where: { userId },
      include: { comments: { orderBy: { createdAt: 'asc' } } },
    });

    const activeDiscussions = discussions.filter((item: any) =>
      ['OPEN', 'IN_PROGRESS', 'WAITING_FOR_TRAINEE'].includes(item.status),
    ).length;
    const overdueCount = discussions.filter((item: any) => {
      const ageMinutes = (Date.now() - new Date(item.updatedAt).getTime()) / 60000;
      return item.status !== 'RESOLVED' && item.status !== 'CLOSED' && ageMinutes > 30;
    }).length;
    const waitingForTraineeCount = discussions.filter(
      (item: any) => item.status === 'WAITING_FOR_TRAINEE',
    ).length;
    const avgResponseMinutes =
      discussions.length > 0
        ? Math.round(
            discussions.reduce((sum: number, item: any) => {
              const responseMinutes = item.comments?.length
                ? Math.max(
                    1,
                    Math.round(
                      (new Date(item.updatedAt).getTime() - new Date(item.createdAt).getTime()) /
                        60000,
                    ),
                  )
                : 0;
              return sum + responseMinutes;
            }, 0) / discussions.length,
          )
        : 0;

    return {
      totalDiscussions: discussions.length,
      activeDiscussions,
      overdueCount,
      waitingForTraineeCount,
      avgResponseMinutes,
    };
  }

  async assignDiscussion(id: string, assignedToId: string): Promise<DiscussionDTO> {
    const discussion = await this.prisma.discussion.findUnique({ where: { id } });
    if (!discussion) throw new NotFoundException('errors.discussion.notFound');

    const nextStatus = discussion.status === 'OPEN' ? 'IN_PROGRESS' : discussion.status;
    await this.prisma.discussion.update({
      where: { id },
      data: {
        assignedToId,
        assignedAt: new Date(),
        status: nextStatus,
      } as any,
    });

    return this.getDiscussionDetails(id);
  }

  private mapDiscussion(d: any): DiscussionDTO {
    const comments = d.comments || [];
    const internalNoteCount = comments.filter((c: any) => c.isInternal).length;
    const mentionCount = comments.reduce(
      (count: number, c: any) => count + (c.mentions?.length || 0),
      0,
    );
    const lastActivityAt =
      comments.length > 0 ? comments[comments.length - 1].createdAt : d.updatedAt;

    return {
      id: d.id,
      userId: d.userId,
      userName: d.user.nickname || d.user.username,
      taskId: d.taskId,
      submissionId: d.submissionId,
      workspaceId: d.workspaceId,
      contextType: d.contextType,
      title: d.title,
      status: d.status,
      priority: d.priority,
      assignedToId: d.assignedToId,
      assignedToName: d.assignedToName,
      assignedAt: d.assignedAt ? d.assignedAt.toISOString() : null,
      lastActivityAt: lastActivityAt.toISOString ? lastActivityAt.toISOString() : lastActivityAt,
      internalNoteCount,
      mentionCount,
      slaStatus:
        d.status === 'WAITING_FOR_TRAINEE'
          ? 'WAITING_FOR_TRAINEE'
          : d.status === 'IN_PROGRESS'
            ? 'IN_PROGRESS'
            : 'NORMAL',
      waitingForTrainee: d.status === 'WAITING_FOR_TRAINEE',
      isOverdue:
        d.status !== 'RESOLVED' &&
        d.status !== 'CLOSED' &&
        (Date.now() - new Date(d.updatedAt).getTime()) / 60000 > 30,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
      comments: comments.map((c: any) => ({
        id: c.id,
        discussionId: c.discussionId,
        authorId: c.authorId,
        authorName: c.author.nickname || c.author.username,
        authorRole: c.author.role,
        content: c.content,
        codeSnippet: c.codeSnippet,
        filePath: c.filePath,
        startLine: c.startLine,
        endLine: c.endLine,
        isInternal: c.isInternal || false,
        mentions: c.mentions || [],
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }
}
