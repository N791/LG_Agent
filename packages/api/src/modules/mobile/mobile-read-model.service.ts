import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Task } from '@prisma/client';
import {
  MOBILE_READ_MODEL_VERSION,
  MobileNextActionType,
  MobileTaskStage,
  MobileTaskStatus,
  SubmissionStatus,
  type MobileFailureActionDTO,
  type MobileFailureSummaryDTO,
  type MobileHomeDTO,
  type MobileKnowledgeCardSummaryDTO,
  type MobileStageProgressDTO,
  type MobileSubmissionSummaryDTO,
  type MobileTaskDetailDTO,
  type MobileTaskPageDTO,
  type MobileTaskSummaryDTO,
} from '@lg-agent/contracts';
import { PrismaService } from '../../common/prisma.service';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

const MOBILE_STAGES = [
  MobileTaskStage.ENVIRONMENT_DISCOVERY,
  MobileTaskStage.KNOWLEDGE_DELIVERY,
  MobileTaskStage.INTERACTIVE_QA,
  MobileTaskStage.HANDS_ON_CODING,
  MobileTaskStage.MICRO_TEST,
  MobileTaskStage.CI_ACCEPTANCE,
] as const;

type MobileTaskRecord = Pick<
  Task,
  'id' | 'courseId' | 'title' | 'summary' | 'description' | 'stage' | 'version' | 'metadata'
> & {
  submissions: MobileSubmissionRecord[];
};

interface MobileSubmissionRecord {
  id: string;
  taskId: string;
  status: string;
  score: number;
  attempt: number;
  report: Prisma.JsonValue | null;
  failureReason: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
}

@Injectable()
export class MobileReadModelService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome(actor: TenantActor): Promise<MobileHomeDTO> {
    const enrollment = await this.prisma.courseEnrollment.findFirst({
      where: {
        userId: actor.id,
        course: { organizationId: actor.organizationId },
        status: { not: 'DROPPED' },
      },
      orderBy: { lastAccessedAt: 'desc' },
      include: { course: { select: { id: true, title: true } } },
    });

    const [tasks, unreadNotificationCount, recentFeedback] = await Promise.all([
      enrollment ? this.findTaskRecords(actor, { courseId: enrollment.courseId }) : [],
      this.prisma.notification.count({
        where: { userId: actor.id, status: 'UNREAD' },
      }),
      this.prisma.notification.findFirst({
        where: { userId: actor.id, status: { not: 'ARCHIVED' } },
        orderBy: { createdAt: 'desc' },
        select: { id: true, type: true, title: true, createdAt: true },
      }),
    ]);

    const summaries = tasks.map((task) => this.toTaskSummary(task));
    const currentTask = summaries.find((task) => task.status !== MobileTaskStatus.COMPLETED);

    return {
      readModelVersion: MOBILE_READ_MODEL_VERSION,
      generatedAt: new Date().toISOString(),
      ...(enrollment && {
        course: {
          id: enrollment.course.id,
          title: enrollment.course.title,
          progress: enrollment.progress,
        },
      }),
      ...(currentTask && { currentTask }),
      unreadNotificationCount,
      ...(recentFeedback && {
        recentFeedback: {
          ...recentFeedback,
          createdAt: recentFeedback.createdAt.toISOString(),
        },
      }),
    };
  }

  async getTasks(
    actor: TenantActor,
    options: { cursor?: string; limit: number; status?: MobileTaskStatus },
  ): Promise<MobileTaskPageDTO> {
    const cursorId = options.cursor ? this.decodeCursor(options.cursor) : undefined;
    const records = await this.findTaskRecords(actor);
    let items = records.map((task) => this.toTaskSummary(task));
    if (options.status) items = items.filter((task) => task.status === options.status);

    const cursorIndex = cursorId ? items.findIndex((item) => item.id === cursorId) : -1;
    if (cursorId && cursorIndex < 0) throw new BadRequestException('errors.mobile.invalidCursor');
    const pageStart = cursorIndex + 1;
    const page = items.slice(pageStart, pageStart + options.limit);
    const hasMore = pageStart + page.length < items.length;
    const lastItem = page.at(-1);

    return {
      readModelVersion: MOBILE_READ_MODEL_VERSION,
      items: page,
      ...(hasMore &&
        lastItem && {
          nextCursor: this.encodeCursor(lastItem.id),
        }),
    };
  }

  async getTask(actor: TenantActor, taskId: string): Promise<MobileTaskDetailDTO> {
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        course: {
          organizationId: actor.organizationId,
          courseEnrollments: { some: { userId: actor.id, status: { not: 'DROPPED' } } },
        },
      },
      select: this.taskSelect(actor.id),
    });
    if (!task) {
      throw new NotFoundException({ message: 'errors.task.notFound', args: { id: taskId } });
    }

    const record = task as MobileTaskRecord;
    const summary = this.toTaskSummary(record);
    return {
      ...summary,
      ...(record.description && { description: record.description }),
      taskVersion: record.version,
      stages: this.toStageProgress(summary.stagePosition, summary.status),
      knowledgeCards: this.toKnowledgeCards(record.metadata),
    };
  }

  async getSubmissionSummary(
    actor: TenantActor,
    submissionId: string,
  ): Promise<MobileSubmissionSummaryDTO> {
    const submission = await this.prisma.submission.findFirst({
      where: {
        id: submissionId,
        userId: actor.id,
        user: { organizationId: actor.organizationId },
        task: {
          course: {
            organizationId: actor.organizationId,
            courseEnrollments: { some: { userId: actor.id, status: { not: 'DROPPED' } } },
          },
        },
      },
      select: this.submissionSelect(),
    });
    if (!submission) {
      throw new NotFoundException({
        message: 'errors.submission.notFound',
        args: { id: submissionId },
      });
    }
    return this.toSubmissionSummary(submission);
  }

  private findTaskRecords(
    actor: TenantActor,
    options: { courseId?: string } = {},
  ): Promise<MobileTaskRecord[]> {
    return this.prisma.task.findMany({
      where: {
        ...(options.courseId && { courseId: options.courseId }),
        course: {
          organizationId: actor.organizationId,
          courseEnrollments: { some: { userId: actor.id, status: { not: 'DROPPED' } } },
        },
      },
      orderBy: [{ stage: 'asc' }, { id: 'asc' }],
      select: this.taskSelect(actor.id),
    });
  }

  private taskSelect(userId: string) {
    return {
      id: true,
      courseId: true,
      title: true,
      summary: true,
      description: true,
      stage: true,
      version: true,
      metadata: true,
      submissions: {
        where: { userId },
        orderBy: { createdAt: 'desc' as const },
        take: 1,
        select: this.submissionSelect(),
      },
    };
  }

  private submissionSelect() {
    return {
      id: true,
      taskId: true,
      status: true,
      score: true,
      attempt: true,
      report: true,
      failureReason: true,
      startedAt: true,
      finishedAt: true,
    };
  }

  private toTaskSummary(task: MobileTaskRecord): MobileTaskSummaryDTO {
    const latest = task.submissions[0];
    const stagePosition = this.resolveStagePosition(task, latest);
    const status = this.resolveTaskStatus(stagePosition, latest);
    const metadata = this.asRecord(task.metadata);
    const blockedReason =
      status === MobileTaskStatus.BLOCKED
        ? (this.safeText(latest?.failureReason) ?? 'The latest validation did not pass.')
        : undefined;
    const nextAction = this.resolveNextAction(task.id, stagePosition, status, latest);
    const requiresPc = metadata?.['requiresPc'] === true || nextAction.requiresPc;

    return {
      id: task.id,
      courseId: task.courseId,
      title: task.title,
      ...(task.summary && { summary: task.summary }),
      status,
      currentStage: MOBILE_STAGES[stagePosition - 1] ?? MobileTaskStage.ENVIRONMENT_DISCOVERY,
      stagePosition,
      requiresPc,
      ...(blockedReason && { blockedReason }),
      nextAction,
      ...(latest && { latestSubmission: this.toSubmissionSummary(latest) }),
    };
  }

  private resolveStagePosition(
    task: MobileTaskRecord,
    submission?: MobileSubmissionRecord,
  ): 1 | 2 | 3 | 4 | 5 | 6 {
    if (submission) return submission.status === 'RUNNING' ? 5 : 6;
    const metadata = this.asRecord(task.metadata);
    const configuredStage = metadata?.['mobileStage'];
    const candidate = typeof configuredStage === 'number' ? configuredStage : task.stage;
    return Math.min(6, Math.max(1, Math.trunc(candidate))) as 1 | 2 | 3 | 4 | 5 | 6;
  }

  private resolveTaskStatus(
    stagePosition: number,
    submission?: MobileSubmissionRecord,
  ): MobileTaskStatus {
    if (!submission) {
      return stagePosition === 1 ? MobileTaskStatus.NOT_STARTED : MobileTaskStatus.IN_PROGRESS;
    }
    switch (submission.status) {
      case 'PASSED':
        return MobileTaskStatus.COMPLETED;
      case 'FAILED':
      case 'ERROR':
        return MobileTaskStatus.BLOCKED;
      case 'PENDING':
      case 'RUNNING':
        return MobileTaskStatus.AWAITING_VALIDATION;
      default:
        return MobileTaskStatus.IN_PROGRESS;
    }
  }

  private resolveNextAction(
    taskId: string,
    stagePosition: number,
    status: MobileTaskStatus,
    submission?: MobileSubmissionRecord,
  ) {
    if (status === MobileTaskStatus.COMPLETED) {
      return {
        type: MobileNextActionType.VIEW_COMPLETION,
        label: 'View completion',
        requiresPc: false,
        taskId,
        ...(submission && { submissionId: submission.id }),
      };
    }
    if (status === MobileTaskStatus.BLOCKED) {
      return {
        type: MobileNextActionType.REVIEW_FAILURE,
        label: 'Review failure and next steps',
        requiresPc: false,
        taskId,
        ...(submission && { submissionId: submission.id }),
      };
    }
    if (status === MobileTaskStatus.AWAITING_VALIDATION) {
      return {
        type: MobileNextActionType.WAIT_FOR_CI,
        label: 'View validation status',
        requiresPc: false,
        taskId,
        ...(submission && { submissionId: submission.id }),
      };
    }
    if (stagePosition === 2) {
      return {
        type: MobileNextActionType.READ_KNOWLEDGE,
        label: 'Read the task knowledge card',
        requiresPc: false,
        taskId,
      };
    }
    if (stagePosition === 3) {
      return {
        type: MobileNextActionType.ASK_AI,
        label: 'Ask the task tutor',
        requiresPc: false,
        taskId,
      };
    }
    return {
      type: MobileNextActionType.CONTINUE_ON_PC,
      label: 'Continue on PC',
      requiresPc: true,
      taskId,
    };
  }

  private toSubmissionSummary(submission: MobileSubmissionRecord): MobileSubmissionSummaryDTO {
    const status = this.toSubmissionStatus(submission.status);
    const failed = status === SubmissionStatus.FAILED || status === SubmissionStatus.ERROR;
    return {
      readModelVersion: MOBILE_READ_MODEL_VERSION,
      submissionId: submission.id,
      taskId: submission.taskId,
      status,
      score: submission.score,
      attempt: submission.attempt,
      ...(submission.startedAt && { startedAt: submission.startedAt.toISOString() }),
      ...(submission.finishedAt && { finishedAt: submission.finishedAt.toISOString() }),
      ...(failed && { failure: this.toFailureSummary(submission) }),
    };
  }

  private toFailureSummary(submission: MobileSubmissionRecord): MobileFailureSummaryDTO {
    const report = this.asRecord(submission.report);
    const primaryCause =
      this.firstSafeString(report, ['primaryCause', 'summary', 'message']) ??
      this.safeText(submission.failureReason) ??
      'Validation did not complete successfully.';
    const affectedChecks = this.safeStringArray(
      report?.['affectedChecks'] ?? report?.['failedChecks'] ?? report?.['failures'],
    );
    const reportActions = this.safeStringArray(report?.['actions'] ?? report?.['recommendations']);
    const actions: MobileFailureActionDTO[] = reportActions.map((label, index) => ({
      id: `report-action-${String(index + 1)}`,
      label,
      kind: 'FIX',
      requiresPc: true,
    }));
    actions.push({
      id: 'ask-ai',
      label: 'Ask AI to explain this failure',
      kind: 'ASK_AI',
      requiresPc: false,
    });
    actions.push({
      id: 'continue-on-pc',
      label: 'Continue fixing on PC',
      kind: 'CONTINUE_ON_PC',
      requiresPc: true,
    });

    return {
      conclusion: submission.status === 'ERROR' ? 'SYSTEM_ERROR' : 'FAILED',
      primaryCause,
      affectedChecks,
      actions: actions.slice(0, 5),
      ...(this.firstSafeString(report, ['evidenceLabel', 'checkName']) && {
        evidenceLabel: this.firstSafeString(report, ['evidenceLabel', 'checkName']),
      }),
    };
  }

  private toStageProgress(
    current: 1 | 2 | 3 | 4 | 5 | 6,
    status: MobileTaskStatus,
  ): MobileStageProgressDTO[] {
    return MOBILE_STAGES.map((stage, index) => {
      const position = (index + 1) as 1 | 2 | 3 | 4 | 5 | 6;
      let state: MobileStageProgressDTO['state'] = 'UPCOMING';
      if (status === MobileTaskStatus.COMPLETED || position < current) state = 'COMPLETED';
      else if (position === current) {
        state = status === MobileTaskStatus.BLOCKED ? 'BLOCKED' : 'CURRENT';
      }
      return { position, stage, state };
    });
  }

  private toKnowledgeCards(value: Prisma.JsonValue | null): MobileKnowledgeCardSummaryDTO[] {
    const metadata = this.asRecord(value);
    const cards = metadata?.['knowledgeCards'];
    if (!Array.isArray(cards)) return [];
    return cards.slice(0, 10).flatMap((card, index) => {
      const record = this.asRecord(card);
      const title = this.safeText(record?.['title']);
      if (!title) return [];
      const minutes = record?.['estimatedMinutes'];
      return [
        {
          id: this.safeText(record?.['id']) ?? `knowledge-card-${String(index + 1)}`,
          title,
          ...(typeof minutes === 'number' &&
            minutes > 0 && {
              estimatedMinutes: Math.round(minutes),
            }),
        },
      ];
    });
  }

  private asRecord(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  }

  private toSubmissionStatus(value: string): SubmissionStatus {
    switch (value) {
      case 'PENDING':
        return SubmissionStatus.PENDING;
      case 'RUNNING':
        return SubmissionStatus.RUNNING;
      case 'PASSED':
        return SubmissionStatus.PASSED;
      case 'FAILED':
        return SubmissionStatus.FAILED;
      case 'CANCELLED':
        return SubmissionStatus.CANCELLED;
      case 'ERROR':
      default:
        return SubmissionStatus.ERROR;
    }
  }

  private firstSafeString(
    record: Record<string, unknown> | undefined,
    keys: string[],
  ): string | undefined {
    for (const key of keys) {
      const value = this.safeText(record?.[key]);
      if (value) return value;
    }
    return undefined;
  }

  private safeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .flatMap((item) => {
        const direct = this.safeText(item);
        if (direct) return [direct];
        const record = this.asRecord(item);
        const nested = this.firstSafeString(record, ['label', 'message', 'name', 'title']);
        return nested ? [nested] : [];
      })
      .slice(0, 5);
  }

  private safeText(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined;
    const normalized = value
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return normalized ? normalized.slice(0, 280) : undefined;
  }

  private encodeCursor(id: string): string {
    return Buffer.from(JSON.stringify({ version: 1, id }), 'utf8').toString('base64url');
  }

  private decodeCursor(cursor: string): string {
    try {
      const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
        version?: unknown;
        id?: unknown;
      };
      if (value.version !== 1 || typeof value.id !== 'string' || !value.id) throw new Error();
      return value.id;
    } catch {
      throw new BadRequestException('errors.mobile.invalidCursor');
    }
  }
}
