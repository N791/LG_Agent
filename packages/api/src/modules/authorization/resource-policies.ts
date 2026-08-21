import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import type { AuthorizationActor, ResourcePolicy } from './authorization.types';

export interface WorkspacePolicyContext {
  workspaceId: string;
}

@Injectable()
export class WorkspaceParticipantPolicy implements ResourcePolicy<WorkspacePolicyContext> {
  constructor(private readonly prisma: PrismaService) {}

  async authorize(actor: AuthorizationActor, context: WorkspacePolicyContext): Promise<boolean> {
    return Boolean(
      await this.prisma.workspace.findFirst({
        where: {
          id: context.workspaceId,
          userId: actor.id,
          user: { organizationId: actor.organizationId },
          task: { course: { organizationId: actor.organizationId } },
        },
        select: { id: true },
      }),
    );
  }
}

export interface SubmissionOwnerPolicyContext {
  submissionId: string;
}

@Injectable()
export class SubmissionOwnerPolicy implements ResourcePolicy<SubmissionOwnerPolicyContext> {
  constructor(private readonly prisma: PrismaService) {}

  async authorize(
    actor: AuthorizationActor,
    context: SubmissionOwnerPolicyContext,
  ): Promise<boolean> {
    return Boolean(
      await this.prisma.submission.findFirst({
        where: {
          id: context.submissionId,
          userId: actor.id,
          user: { organizationId: actor.organizationId },
          task: { course: { organizationId: actor.organizationId } },
        },
        select: { id: true },
      }),
    );
  }
}

export interface MentorAssignmentPolicyContext {
  discussionId: string;
}

@Injectable()
export class MentorAssignmentPolicy implements ResourcePolicy<MentorAssignmentPolicyContext> {
  constructor(private readonly prisma: PrismaService) {}

  async authorize(
    actor: AuthorizationActor,
    context: MentorAssignmentPolicyContext,
  ): Promise<boolean> {
    return Boolean(
      await this.prisma.discussion.findFirst({
        where: {
          id: context.discussionId,
          assignedToId: actor.id,
          user: { organizationId: actor.organizationId },
          task: { course: { organizationId: actor.organizationId } },
        },
        select: { id: true },
      }),
    );
  }
}
