import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma.service';
import { DataLifecyclePolicyProvider } from './data-lifecycle.policy';

export interface SubmissionArchiveCandidate {
  id: string;
  organizationId: string;
  artifactBytes: bigint;
  createdAt: Date;
}

export type RetentionResult = Readonly<Record<string, number>>;

@Injectable()
export class DataLifecycleService {
  private readonly logger = new Logger(DataLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly policies: DataLifecyclePolicyProvider,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async scheduledRetention(): Promise<void> {
    const result = await this.runRetention();
    if (Object.keys(result).length > 0) {
      this.logger.log({ event: 'data_retention_completed', deleted: result });
    }
  }

  async runRetention(now = new Date()): Promise<RetentionResult> {
    const policy = this.policies.policy;
    if (!policy.enabled) return {};

    const cutoff = (days: number) => new Date(now.getTime() - days * 86_400_000);
    const batch = policy.batchSize;

    const [
      workspaceVersions,
      conversationMessages,
      llmRequestLogs,
      llmAuditLogs,
      auditEvents,
      clientLogs,
      clientMetrics,
      retrievalEvidence,
      retrievalTraces,
      conversationSummaries,
    ] = await this.prisma.$transaction([
      this.prisma.$executeRaw(Prisma.sql`
        WITH ranked AS (
          SELECT "id", "created_at",
            row_number() OVER (
              PARTITION BY "workspace_id"
              ORDER BY "version" DESC, "created_at" DESC, "id" DESC
            ) AS version_rank
          FROM "workspace_versions"
        ),
        expired AS (
          SELECT "id"
          FROM ranked
          WHERE version_rank > ${policy.workspaceVersionMaxCount}
             OR ("created_at" < ${cutoff(policy.workspaceVersionRetentionDays)} AND version_rank > 1)
          LIMIT ${batch}
        )
        DELETE FROM "workspace_versions"
        WHERE "id" IN (SELECT "id" FROM expired)
      `),
      this.prisma.$executeRaw(Prisma.sql`
        WITH expired AS (
          SELECT message."id"
          FROM "conversation_messages" message
          JOIN "conversations" conversation ON conversation."id" = message."conversation_id"
          WHERE message."created_at" < ${cutoff(policy.conversationRetentionDays)}
            AND conversation."updated_at" < ${cutoff(policy.conversationRetentionDays)}
          LIMIT ${batch}
        )
        DELETE FROM "conversation_messages"
        WHERE "id" IN (SELECT "id" FROM expired)
      `),
      this.deleteOldRows('llm_request_logs', cutoff(policy.llmRequestRetentionDays), batch),
      this.deleteOldRows('llm_audit_logs', cutoff(policy.llmAuditRetentionDays), batch),
      this.deleteOldRows('audit_events', cutoff(policy.auditEventRetentionDays), batch),
      this.deleteOldRows('client_logs', cutoff(policy.clientLogRetentionDays), batch),
      this.deleteOldRows('client_metrics', cutoff(policy.clientMetricRetentionDays), batch),
      this.deleteExpiredRows('retrieval_evidence', now, batch),
      this.deleteExpiredRows('retrieval_traces', now, batch),
      this.deleteExpiredRows('conversation_summaries', now, batch),
    ]);

    return {
      workspaceVersions,
      conversationMessages,
      llmRequestLogs,
      llmAuditLogs,
      auditEvents,
      clientLogs,
      clientMetrics,
      retrievalEvidence,
      retrievalTraces,
      conversationSummaries,
    };
  }

  /**
   * Returns tenant-scoped artifacts that must be copied to object storage.
   * The caller must verify the object checksum before clearing database payloads.
   */
  async findSubmissionArchiveCandidates(limit?: number): Promise<SubmissionArchiveCandidate[]> {
    const policy = this.policies.policy;
    const candidateLimit = Math.min(limit ?? policy.batchSize, policy.batchSize);
    return this.prisma.$queryRaw<SubmissionArchiveCandidate[]>(Prisma.sql`
      SELECT
        submission."id",
        user_account."organization_id" AS "organizationId",
        (
          coalesce(octet_length(submission."logs"), 0)
          + coalesce(pg_column_size(submission."report"), 0)
        )::bigint AS "artifactBytes",
        submission."created_at" AS "createdAt"
      FROM "submissions" submission
      JOIN "users" user_account ON user_account."id" = submission."user_id"
      WHERE submission."status" IN ('PASSED', 'FAILED', 'ERROR', 'CANCELLED')
        AND (
          coalesce(octet_length(submission."logs"), 0)
          + coalesce(pg_column_size(submission."report"), 0)
        ) >= ${policy.submissionArchiveThresholdBytes}
      ORDER BY submission."created_at" ASC
      LIMIT ${candidateLimit}
    `);
  }

  private deleteOldRows(
    table: RetentionTable,
    cutoff: Date,
    batch: number,
  ): Prisma.PrismaPromise<number> {
    const tableName = Prisma.raw(`"${table}"`);
    return this.prisma.$executeRaw(Prisma.sql`
      WITH expired AS (
        SELECT ctid
        FROM ${tableName}
        WHERE "created_at" < ${cutoff}
        LIMIT ${batch}
      )
      DELETE FROM ${tableName}
      WHERE ctid IN (SELECT ctid FROM expired)
    `);
  }

  private deleteExpiredRows(
    table: ExpiringRetentionTable,
    now: Date,
    batch: number,
  ): Prisma.PrismaPromise<number> {
    const tableName = Prisma.raw(`"${table}"`);
    return this.prisma.$executeRaw(Prisma.sql`
      WITH expired AS (
        SELECT ctid
        FROM ${tableName}
        WHERE "expires_at" <= ${now}
        LIMIT ${batch}
      )
      DELETE FROM ${tableName}
      WHERE ctid IN (SELECT ctid FROM expired)
    `);
  }
}

type RetentionTable =
  'llm_request_logs' | 'llm_audit_logs' | 'audit_events' | 'client_logs' | 'client_metrics';

type ExpiringRetentionTable = 'retrieval_evidence' | 'retrieval_traces' | 'conversation_summaries';
