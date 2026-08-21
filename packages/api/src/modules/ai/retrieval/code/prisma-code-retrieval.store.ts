import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma.service';
import type {
  CodeRelationRecord,
  CodeSymbolRecord,
  ICodeRetrievalStore,
} from './code-retrieval.store';

interface SymbolRow {
  id: string;
  organizationId: string;
  repositorySnapshotId: string;
  repositoryId: string;
  repositoryName: string;
  canonicalUri: string;
  commitSha: string;
  name: string;
  qualifiedName: string;
  kind: CodeSymbolRecord['kind'];
  language: string;
  path: string;
  startLine: number;
  endLine: number;
  signature: string | null;
  docComment: string | null;
  summary: string;
  content: string;
  parseConfidence: number;
  fallbackReason: string | null;
  score: number;
}

export function parseStackLocation(query: string): { path: string; line: number } | undefined {
  const match = /(?:^|[\s(])([^():\s]+\.[cm]?[jt]sx?):(\d+)(?::\d+)?/.exec(query);
  if (!match?.[1] || !match[2]) return undefined;
  return {
    path: match[1].replaceAll('\\', '/'),
    line: Number.parseInt(match[2], 10),
  };
}

@Injectable()
export class PrismaCodeRetrievalStore implements ICodeRetrievalStore {
  constructor(private readonly prisma: PrismaService) {}

  async search(input: Parameters<ICodeRetrievalStore['search']>[0]): Promise<CodeSymbolRecord[]> {
    const stackLocation = parseStackLocation(input.query);
    const path = stackLocation?.path;
    const line = stackLocation?.line;
    const query = input.query.trim().toLowerCase();
    const rows = await this.prisma.$queryRaw<SymbolRow[]>(Prisma.sql`
      SELECT ${this.columns()},
        CASE
          WHEN ${path ?? null} IS NOT NULL AND s."path" = ${path ?? null}
            AND ${line ?? null} BETWEEN s."start_line" AND s."end_line" THEN 1.0
          WHEN lower(s."qualified_name") = ${query} THEN 0.98
          WHEN lower(s."name") = ${query} THEN 0.95
          WHEN lower(s."signature") = ${query} THEN 0.92
          WHEN lower(s."qualified_name") LIKE ${`%${query}%`} THEN 0.82
          WHEN lower(s."path") LIKE ${`%${query}%`} THEN 0.75
          ELSE 0.55
        END::float8 AS "score"
      FROM "code_symbols" s
      JOIN "repository_snapshots" rs ON rs."id" = s."repository_snapshot_id"
      JOIN "code_repositories" r ON r."id" = rs."code_repository_id"
      WHERE s."organization_id" = ${input.organizationId}::uuid
        AND rs."status" = 'READY'
        AND (${input.repositorySnapshotId ?? null}::uuid IS NULL
             OR rs."id" = ${input.repositorySnapshotId ?? null}::uuid)
        AND (
          ${input.repositorySnapshotId ?? null}::uuid IS NOT NULL
          OR COALESCE((rs."metadata"->>'active')::boolean, false)
          OR (
            NOT EXISTS (
              SELECT 1 FROM "repository_snapshots" selected
              WHERE selected."repository_id" = rs."repository_id"
                AND selected."status" = 'READY'
                AND COALESCE((selected."metadata"->>'active')::boolean, false)
            )
            AND NOT EXISTS (
              SELECT 1 FROM "repository_snapshots" newer
              WHERE newer."repository_id" = rs."repository_id"
                AND newer."status" = 'READY'
                AND newer."created_at" > rs."created_at"
            )
          )
        )
        AND ${this.aclPredicate(input.userId)}
        AND (
          (${path ?? null} IS NOT NULL AND s."path" = ${path ?? null}
            AND ${line ?? null} BETWEEN s."start_line" AND s."end_line")
          OR lower(s."name") = ${query}
          OR lower(s."qualified_name") LIKE ${`%${query}%`}
          OR lower(s."path") LIKE ${`%${query}%`}
          OR lower(COALESCE(s."signature", '')) LIKE ${`%${query}%`}
        )
      ORDER BY "score" DESC, s."qualified_name", s."id"
      LIMIT ${input.limit}
    `);
    return rows.map((row) => this.map(row));
  }

  async read(
    input: Parameters<ICodeRetrievalStore['read']>[0],
  ): Promise<CodeSymbolRecord | undefined> {
    const rows = await this.prisma.$queryRaw<SymbolRow[]>(Prisma.sql`
      SELECT ${this.columns()}, 1.0::float8 AS "score"
      FROM "code_symbols" s
      JOIN "repository_snapshots" rs ON rs."id" = s."repository_snapshot_id"
      JOIN "code_repositories" r ON r."id" = rs."code_repository_id"
      WHERE s."organization_id" = ${input.organizationId}::uuid
        AND s."repository_snapshot_id" = ${input.repositorySnapshotId}::uuid
        AND s."id" = ${input.symbolId}::uuid
        AND rs."status" = 'READY'
        AND ${this.aclPredicate(input.userId)}
      LIMIT 1
    `);
    return rows[0] ? this.map(rows[0]) : undefined;
  }

  async relations(
    input: Parameters<ICodeRetrievalStore['relations']>[0],
  ): Promise<CodeRelationRecord[]> {
    return this.prisma.$queryRaw<CodeRelationRecord[]>(Prisma.sql`
      SELECT cr."source_symbol_id" AS "sourceSymbolId",
             cr."target_symbol_id" AS "targetSymbolId",
             cr."relation_type"::text AS "relationType",
             COALESCE((cr."metadata"->>'confidence')::float8, 1.0) AS "confidence",
             cr."metadata"->>'heuristic' AS "heuristic"
      FROM "code_relations" cr
      JOIN "repository_snapshots" rs ON rs."id" = cr."repository_snapshot_id"
      WHERE cr."organization_id" = ${input.organizationId}::uuid
        AND cr."repository_snapshot_id" = ${input.repositorySnapshotId}::uuid
        AND rs."status" = 'READY'
        AND ${this.snapshotAclPredicate(input.userId)}
      ORDER BY cr."source_symbol_id", cr."target_symbol_id", cr."relation_type"
      LIMIT 10000
    `);
  }

  async readMany(
    input: Parameters<ICodeRetrievalStore['readMany']>[0],
  ): Promise<CodeSymbolRecord[]> {
    if (!input.symbolIds.length) return [];
    const rows = await this.prisma.$queryRaw<SymbolRow[]>(Prisma.sql`
      SELECT ${this.columns()}, 1.0::float8 AS "score"
      FROM "code_symbols" s
      JOIN "repository_snapshots" rs ON rs."id" = s."repository_snapshot_id"
      JOIN "code_repositories" r ON r."id" = rs."code_repository_id"
      WHERE s."organization_id" = ${input.organizationId}::uuid
        AND s."repository_snapshot_id" = ${input.repositorySnapshotId}::uuid
        AND s."id" IN (${Prisma.join(input.symbolIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND rs."status" = 'READY'
        AND ${this.aclPredicate(input.userId)}
    `);
    return rows.map((row) => this.map(row));
  }

  private columns(): Prisma.Sql {
    return Prisma.sql`
      s."id", s."organization_id" AS "organizationId",
      s."repository_snapshot_id" AS "repositorySnapshotId",
      r."external_key" AS "repositoryId", r."name" AS "repositoryName",
      r."canonical_uri" AS "canonicalUri", rs."commit_sha" AS "commitSha",
      s."name", s."qualified_name" AS "qualifiedName", s."kind",
      COALESCE(s."metadata"->>'language', 'unsupported') AS "language",
      s."path", s."start_line" AS "startLine", s."end_line" AS "endLine",
      s."signature", s."metadata"->>'docComment' AS "docComment",
      COALESCE(s."metadata"->>'summary', s."name") AS "summary",
      COALESCE(s."metadata"->>'content', '') AS "content",
      COALESCE((s."metadata"->>'parseConfidence')::float8, 0.0) AS "parseConfidence",
      s."metadata"->>'fallbackReason' AS "fallbackReason"
    `;
  }

  private aclPredicate(userId: string): Prisma.Sql {
    return Prisma.sql`
      (
        rs."acl" = '{}'::jsonb
        OR COALESCE((rs."acl"->>'public')::boolean, false)
        OR rs."acl"->'userIds' ? ${userId}
        OR EXISTS (
          SELECT 1 FROM "users" u
          WHERE u."id" = ${userId}::uuid
            AND u."organization_id" = rs."organization_id"
            AND u."role" IN ('ADMIN', 'MENTOR')
        )
      )
    `;
  }

  private snapshotAclPredicate(userId: string): Prisma.Sql {
    return Prisma.sql`
      (
        rs."acl" = '{}'::jsonb
        OR COALESCE((rs."acl"->>'public')::boolean, false)
        OR rs."acl"->'userIds' ? ${userId}
        OR EXISTS (
          SELECT 1 FROM "users" u
          WHERE u."id" = ${userId}::uuid
            AND u."organization_id" = rs."organization_id"
            AND u."role" IN ('ADMIN', 'MENTOR')
        )
      )
    `;
  }

  private map(row: SymbolRow): CodeSymbolRecord {
    const { signature, docComment, fallbackReason, ...required } = row;
    return {
      ...required,
      ...(signature ? { signature } : {}),
      ...(docComment ? { docComment } : {}),
      ...(fallbackReason ? { fallbackReason } : {}),
    };
  }
}
