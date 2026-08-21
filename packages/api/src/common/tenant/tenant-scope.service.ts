import { Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { TenantActor } from './organization-scoped.repository';

@Injectable()
export class TenantScopeService {
  constructor(private readonly prisma: PrismaService) {}

  course(actor: TenantActor): Prisma.CourseWhereInput {
    return { organizationId: actor.organizationId };
  }

  task(actor: TenantActor): Prisma.TaskWhereInput {
    return { course: { organizationId: actor.organizationId } };
  }

  workspace(actor: TenantActor): Prisma.WorkspaceWhereInput {
    return {
      user: { organizationId: actor.organizationId },
      task: { course: { organizationId: actor.organizationId } },
    };
  }

  submission(actor: TenantActor): Prisma.SubmissionWhereInput {
    return {
      user: { organizationId: actor.organizationId },
      task: { course: { organizationId: actor.organizationId } },
    };
  }

  conversation(actor: TenantActor): Prisma.ConversationWhereInput {
    return { organizationId: actor.organizationId };
  }

  discussion(actor: TenantActor): Prisma.DiscussionWhereInput {
    return {
      user: { organizationId: actor.organizationId },
      task: { course: { organizationId: actor.organizationId } },
    };
  }

  async assertTask(taskId: string, actor: TenantActor): Promise<void> {
    const task = await this.prisma.task.findFirst({
      where: { id: taskId, ...this.task(actor) },
      select: { id: true },
    });
    if (!task) {
      await this.recordBoundaryMiss(actor, 'task', taskId);
      throw new NotFoundException({ message: 'errors.task.notFound', args: { id: taskId } });
    }
  }

  async assertTaskCourse(courseId: string, actor: TenantActor): Promise<void> {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!course) {
      await this.recordBoundaryMiss(actor, 'course', courseId);
      throw new NotFoundException({ message: 'errors.course.notFound', args: { id: courseId } });
    }
  }

  async assertUser(userId: string, actor: TenantActor): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!user) {
      await this.recordBoundaryMiss(actor, 'user', userId);
      throw new NotFoundException({ message: 'errors.auth.userNotFound' });
    }
  }

  private async recordBoundaryMiss(
    actor: TenantActor,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    await this.prisma.auditEvent
      .create({
        data: {
          action: 'authorization.resource_boundary_miss',
          actorId: actor.id,
          resourceId,
          metadata: {
            organizationId: actor.organizationId,
            resourceType,
          },
        },
      })
      .catch(() => undefined);
  }
}
