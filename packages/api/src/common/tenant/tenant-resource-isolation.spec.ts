import { NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AiConversationService } from '../../modules/ai/conversation/ai-conversation.service';
import { CoursesService } from '../../modules/courses/courses.service';
import { DiscussionsService } from '../../modules/discussions/discussions.service';
import { SubmissionsService } from '../../modules/submissions/submissions.service';
import { TasksService } from '../../modules/tasks/tasks.service';
import { AuthoringWorkspaceService } from '../../modules/workspace/authoring-workspace.service';
import { TenantScopeService } from './tenant-scope.service';

const crossTenantActor = {
  id: 'user-b',
  organizationId: 'organization-b',
  role: Role.TRAINEE,
};

describe('tenant resource cross-organization rejection', () => {
  it('rejects a Course outside the actor organization', async () => {
    const prisma = { course: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new CoursesService(prisma as never, new TenantScopeService(prisma as never));
    await expect(service.findOne('course-a', crossTenantActor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.course.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'course-a', organizationId: 'organization-b' },
      }),
    );
  });

  it('rejects a Task outside the actor organization', async () => {
    const prisma = { task: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new TasksService(prisma as never, new TenantScopeService(prisma as never));
    await expect(service.findOne('task-a', crossTenantActor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.task.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'task-a',
          course: { organizationId: 'organization-b' },
        },
      }),
    );
  });

  it('rejects a Workspace whose task is outside the user organization', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'organization-b' }),
      },
      workspace: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new AuthoringWorkspaceService(prisma as never, {} as never);
    await expect(service.getWorkspace('task-a', 'user-b')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.workspace.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          task: { course: { organizationId: 'organization-b' } },
        }) as unknown,
      }),
    );
  });

  it('rejects a Submission outside the actor organization', async () => {
    const prisma = { submission: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new SubmissionsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      [],
      new TenantScopeService(prisma as never),
    );
    await expect(service.findOne('submission-a', crossTenantActor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.submission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: { organizationId: 'organization-b' },
          task: { course: { organizationId: 'organization-b' } },
        }) as unknown,
      }),
    );
  });

  it('does not return a Conversation outside the actor organization', async () => {
    const prisma = { conversation: { findFirst: jest.fn().mockResolvedValue(null) } };
    const service = new AiConversationService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.getConversationHistory('task-a', 'user-b', 'organization-b'),
    ).resolves.toBeNull();
    expect(prisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId: 'task-a', userId: 'user-b', organizationId: 'organization-b' },
      }),
    );
  });

  it('rejects a Discussion outside the actor organization', async () => {
    const prisma = { discussion: { findFirst: jest.fn().mockResolvedValue(null) } };
    const scope = new TenantScopeService(prisma as never);
    const service = new DiscussionsService(prisma as never, {} as never, scope);
    await expect(
      service.getDiscussionDetails('discussion-a', crossTenantActor),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.discussion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          user: { organizationId: 'organization-b' },
          task: { course: { organizationId: 'organization-b' } },
        }) as unknown,
      }),
    );
  });
});
