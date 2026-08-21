/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { DiscussionsService } from './discussions.service';
import { PrismaService } from '../../common/prisma.service';
import { NOTIFICATION_PUBLISHER } from '../notifications/notification-publisher.interface';
import { TenantScopeService } from '../../common/tenant/tenant-scope.service';
import { Role } from '@prisma/client';

describe('DiscussionsService', () => {
  let service: DiscussionsService;
  let prisma: {
    discussion: {
      create: jest.Mock;
      findMany: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    discussionComment: {
      create: jest.Mock;
    };
    user: { findFirst: jest.Mock };
  };
  let notificationPublisher: { publish: jest.Mock };

  beforeEach(async () => {
    prisma = {
      discussion: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      discussionComment: {
        create: jest.fn(),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mentor-1',
          username: 'mentor',
          nickname: 'Mentor',
        }),
      },
    };
    notificationPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscussionsService,
        { provide: PrismaService, useValue: prisma },
        { provide: NOTIFICATION_PUBLISHER, useValue: notificationPublisher },
        {
          provide: TenantScopeService,
          useValue: {
            discussion: jest.fn().mockReturnValue({}),
            workspace: jest.fn().mockReturnValue({}),
            submission: jest.fn().mockReturnValue({}),
            assertTask: jest.fn(),
            assertUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DiscussionsService>(DiscussionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should persist mentions and internal notes when adding a comment', async () => {
    prisma.discussion.findFirst.mockResolvedValue({
      id: 'discussion-1',
      status: 'OPEN',
      userId: 'user-1',
      user: { nickname: 'Trainee', username: 'trainee' },
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    prisma.discussionComment.create.mockResolvedValue({});
    prisma.discussion.update.mockResolvedValue({});

    await service.addComment(
      'discussion-1',
      { id: 'mentor-1', organizationId: 'org-1', role: Role.MENTOR },
      {
        content: 'Please review @alice and share feedback',
        isInternal: true,
        mentions: ['alice'],
      },
    );

    expect(prisma.discussionComment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'Please review @alice and share feedback',
          isInternal: true,
          mentions: ['alice'],
        }),
      }),
    );
  });

  it('should assign a discussion to a mentor and stamp the assignment time', async () => {
    prisma.discussion.findFirst.mockResolvedValue({
      id: 'discussion-1',
      status: 'OPEN',
      userId: 'user-1',
      user: { nickname: 'Trainee', username: 'trainee' },
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.assignDiscussion('discussion-1', 'mentor-1', {
      id: 'mentor-1',
      organizationId: 'org-1',
      role: Role.MENTOR,
    });

    expect(prisma.discussion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'discussion-1' },
        data: expect.objectContaining({
          assignedToId: 'mentor-1',
          assignedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('should resolve discussions and expose analytics', async () => {
    prisma.discussion.findFirst.mockResolvedValue({
      id: 'discussion-1',
      status: 'IN_PROGRESS',
      userId: 'user-1',
      user: { nickname: 'Trainee', username: 'trainee' },
      comments: [],
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
      updatedAt: new Date(),
    });
    prisma.discussion.update.mockResolvedValue({});

    const actor = { id: 'mentor-1', organizationId: 'org-1', role: Role.MENTOR };
    await service.resolveDiscussion('discussion-1', actor);

    expect(prisma.discussion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'RESOLVED' }),
      }),
    );

    prisma.discussion.findMany.mockResolvedValue([
      {
        id: 'discussion-1',
        status: 'IN_PROGRESS',
        userId: 'user-1',
        user: { nickname: 'Trainee', username: 'trainee' },
        comments: [],
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
        updatedAt: new Date(),
      },
    ]);

    const analytics = await service.getDiscussionAnalytics(actor);
    expect(analytics.totalDiscussions).toBe(1);
    expect(analytics.overdueCount).toBeGreaterThanOrEqual(0);
  });

  it('should prioritize urgent and overdue discussions in the queue', async () => {
    prisma.discussion.findMany.mockResolvedValue([
      {
        id: 'discussion-2',
        status: 'OPEN',
        priority: 'NORMAL',
        userId: 'user-1',
        user: { nickname: 'Trainee', username: 'trainee' },
        comments: [],
        createdAt: new Date(Date.now() - 5 * 60 * 1000),
        updatedAt: new Date(Date.now() - 5 * 60 * 1000),
      },
      {
        id: 'discussion-1',
        status: 'OPEN',
        priority: 'URGENT',
        userId: 'user-1',
        user: { nickname: 'Trainee', username: 'trainee' },
        comments: [],
        createdAt: new Date(Date.now() - 40 * 60 * 1000),
        updatedAt: new Date(Date.now() - 40 * 60 * 1000),
      },
    ]);

    const discussions = await service.getDiscussions({
      id: 'user-1',
      organizationId: 'org-1',
      role: Role.TRAINEE,
    });

    expect(discussions[0]?.id).toBe('discussion-1');
    expect(discussions[0]?.priority).toBe('URGENT');
  });
});
