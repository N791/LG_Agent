import { Test, TestingModule } from '@nestjs/testing';
import { DiscussionsService } from './discussions.service';
import { PrismaService } from '../../common/prisma.service';
import { NOTIFICATION_PUBLISHER } from '../notifications/notification-publisher.interface';

describe('DiscussionsService', () => {
  let service: DiscussionsService;
  let prisma: {
    discussion: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    discussionComment: {
      create: jest.Mock;
    };
  };
  let notificationPublisher: { publish: jest.Mock };

  beforeEach(async () => {
    prisma = {
      discussion: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      discussionComment: {
        create: jest.fn(),
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
      ],
    }).compile();

    service = module.get<DiscussionsService>(DiscussionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should persist mentions and internal notes when adding a comment', async () => {
    prisma.discussion.findUnique.mockResolvedValue({
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

    await service.addComment('discussion-1', { id: 'mentor-1', username: 'mentor', nickname: 'Mentor', role: 'MENTOR' } as any, {
      content: 'Please review @alice and share feedback',
      isInternal: true,
      mentions: ['alice'],
    } as any);

    expect(prisma.discussionComment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        content: 'Please review @alice and share feedback',
        isInternal: true,
        mentions: ['alice'],
      }),
    }));
  });

  it('should assign a discussion to a mentor and stamp the assignment time', async () => {
    prisma.discussion.findUnique.mockResolvedValue({
      id: 'discussion-1',
      status: 'OPEN',
      userId: 'user-1',
      user: { nickname: 'Trainee', username: 'trainee' },
      comments: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await service.assignDiscussion('discussion-1', 'mentor-1');

    expect(prisma.discussion.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'discussion-1' },
      data: expect.objectContaining({
        assignedToId: 'mentor-1',
        assignedAt: expect.any(Date),
      }),
    }));
  });

  it('should resolve discussions and expose analytics', async () => {
    prisma.discussion.findUnique.mockResolvedValue({
      id: 'discussion-1',
      status: 'IN_PROGRESS',
      userId: 'user-1',
      user: { nickname: 'Trainee', username: 'trainee' },
      comments: [],
      createdAt: new Date(Date.now() - 10 * 60 * 1000),
      updatedAt: new Date(),
    });
    prisma.discussion.update.mockResolvedValue({});

    await service.resolveDiscussion('discussion-1');

    expect(prisma.discussion.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'RESOLVED' }),
    }));

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

    const analytics = await service.getDiscussionAnalytics('user-1');
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

    const discussions = await service.getDiscussions('user-1');

    expect(discussions[0].id).toBe('discussion-1');
    expect(discussions[0].priority).toBe('URGENT');
  });
});
