import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma.service';
import { LLMGatewayService } from '../../gateway/llm-gateway.service';
import type {
  DocumentCandidate,
  DocumentSearchRequest,
  ExpansionRequest,
  IDocumentExpansionStore,
  IDocumentSearchChannel,
  RetrievalChannel,
} from './hybrid-retrieval.interfaces';
import type { DocumentLocator } from './document-structure.types';

interface DocumentCandidateRow {
  chunkId: string;
  nodeId: string;
  parentId: string | null;
  documentId: string;
  documentVersionId: string;
  version: number;
  organizationId: string;
  sourceTitle: string;
  sourceUri: string;
  content: string;
  sectionPath: unknown;
  locator: unknown;
  tokenCount: number;
  score: number;
}

@Injectable()
export class PrismaDocumentSearchStore {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: LLMGatewayService,
  ) {}

  async keywordSearch(request: DocumentSearchRequest): Promise<DocumentCandidate[]> {
    const filters = this.filters(request);
    const rows = await this.prisma.$queryRaw<DocumentCandidateRow[]>(Prisma.sql`
      SELECT
        c."id" AS "chunkId", c."node_id" AS "nodeId", n."parent_id" AS "parentId",
        s."id" AS "documentId", dv."id" AS "documentVersionId", dv."version",
        c."organization_id" AS "organizationId", s."title" AS "sourceTitle",
        s."canonical_uri" AS "sourceUri", c."content", n."section_path" AS "sectionPath",
        n."locator", c."token_count" AS "tokenCount",
        (
          ts_rank_cd(c."search_vector", websearch_to_tsquery('simple', ${request.query}))
          + CASE WHEN lower(c."content") LIKE ${`%${request.query.toLowerCase()}%`} THEN 1 ELSE 0 END
        )::double precision AS "score"
      FROM "document_chunks" c
      JOIN "document_nodes" n ON n."id" = c."node_id"
      JOIN "document_versions" dv ON dv."id" = c."document_version_id"
      JOIN "knowledge_sources" s ON s."id" = dv."source_id"
      WHERE ${filters}
        AND (
          c."search_vector" @@ websearch_to_tsquery('simple', ${request.query})
          OR lower(c."content") LIKE ${`%${request.query.toLowerCase()}%`}
        )
      ORDER BY "score" DESC, c."id"
      LIMIT ${request.limit}
    `);
    return this.mapRows(rows, 'keyword', 'full-text-or-exact-phrase');
  }

  async vectorSearch(request: DocumentSearchRequest): Promise<DocumentCandidate[]> {
    const [embedding] = await this.gateway.embed([request.query]);
    if (!embedding?.length) throw new Error('Query embedding is unavailable.');
    const filters = this.filters(request);
    const serialized = `[${embedding.join(',')}]`;
    const rows = await this.prisma.$queryRaw<DocumentCandidateRow[]>(Prisma.sql`
      SELECT
        c."id" AS "chunkId", c."node_id" AS "nodeId", n."parent_id" AS "parentId",
        s."id" AS "documentId", dv."id" AS "documentVersionId", dv."version",
        c."organization_id" AS "organizationId", s."title" AS "sourceTitle",
        s."canonical_uri" AS "sourceUri", c."content", n."section_path" AS "sectionPath",
        n."locator", c."token_count" AS "tokenCount",
        (1 - (c."embedding" <=> ${serialized}::vector))::double precision AS "score"
      FROM "document_chunks" c
      JOIN "document_nodes" n ON n."id" = c."node_id"
      JOIN "document_versions" dv ON dv."id" = c."document_version_id"
      JOIN "knowledge_sources" s ON s."id" = dv."source_id"
      WHERE ${filters} AND c."embedding" IS NOT NULL
      ORDER BY c."embedding" <=> ${serialized}::vector, c."id"
      LIMIT ${request.limit}
    `);
    return this.mapRows(rows, 'vector', 'semantic-similarity');
  }

  async expand(request: ExpansionRequest): Promise<DocumentCandidate[]> {
    const rows = await this.prisma.$queryRaw<DocumentCandidateRow[]>(Prisma.sql`
      WITH target AS (
        SELECT c."node_id", n."parent_id"
        FROM "document_chunks" c
        JOIN "document_nodes" n ON n."id" = c."node_id"
        WHERE c."id" = ${request.chunkId}::uuid
          AND c."document_version_id" = ${request.documentVersionId}::uuid
          AND c."organization_id" = ${request.organizationId}::uuid
      )
      SELECT
        c."id" AS "chunkId", c."node_id" AS "nodeId", n."parent_id" AS "parentId",
        s."id" AS "documentId", dv."id" AS "documentVersionId", dv."version",
        c."organization_id" AS "organizationId", s."title" AS "sourceTitle",
        s."canonical_uri" AS "sourceUri", c."content", n."section_path" AS "sectionPath",
        n."locator", c."token_count" AS "tokenCount", 0::double precision AS "score"
      FROM "document_chunks" c
      JOIN "document_nodes" n ON n."id" = c."node_id"
      JOIN "document_versions" dv ON dv."id" = c."document_version_id"
      JOIN "knowledge_sources" s ON s."id" = dv."source_id"
      CROSS JOIN target t
      WHERE c."organization_id" = ${request.organizationId}::uuid
        AND c."document_version_id" = ${request.documentVersionId}::uuid
        AND dv."status" = 'READY'
        AND (
          s."acl" = '{}'::jsonb OR s."acl"->>'public' = 'true'
          OR coalesce(s."acl"->'userIds', '[]'::jsonb) ? ${request.userId}
          OR EXISTS (
            SELECT 1 FROM "users" u
            WHERE u."id" = ${request.userId}::uuid
              AND u."organization_id" = s."organization_id"
              AND (
                u."role" IN ('ADMIN', 'MENTOR')
                OR coalesce(s."acl"->'roles', '[]'::jsonb) ? u."role"::text
              )
          )
        )
        AND (n."id" = t."parent_id" OR n."parent_id" = t."parent_id" OR n."id" = t."node_id")
      ORDER BY n."ordinal", c."ordinal", c."id"
      LIMIT 50
    `);
    let used = 0;
    const bounded = rows.filter((row) => {
      if (used + row.tokenCount > request.tokenBudget) return false;
      used += row.tokenCount;
      return true;
    });
    return this.mapRows(bounded, 'keyword', 'parent-or-adjacent-expansion');
  }

  private filters(request: DocumentSearchRequest): Prisma.Sql {
    const sourceFilter = request.knowledgeSourceIds?.length
      ? Prisma.sql`s."id" IN (${Prisma.join(
          request.knowledgeSourceIds.map((id) => Prisma.sql`${id}::uuid`),
        )})`
      : Prisma.sql`TRUE`;
    const versionFilter = request.documentVersionIds?.length
      ? Prisma.sql`dv."id" IN (${Prisma.join(
          request.documentVersionIds.map((id) => Prisma.sql`${id}::uuid`),
        )})`
      : Prisma.sql`(
          COALESCE((dv."metadata"->>'active')::boolean, false)
          OR (
            NOT EXISTS (
              SELECT 1 FROM "document_versions" selected
              WHERE selected."source_id" = dv."source_id"
                AND selected."status" = 'READY'
                AND COALESCE((selected."metadata"->>'active')::boolean, false)
            )
            AND NOT EXISTS (
              SELECT 1 FROM "document_versions" newer
              WHERE newer."source_id" = dv."source_id"
                AND newer."status" = 'READY'
                AND newer."version" > dv."version"
            )
          )
        )`;
    const metadataFilter = request.metadataFilters
      ? Prisma.sql`c."metadata" @> ${JSON.stringify(request.metadataFilters)}::jsonb`
      : Prisma.sql`TRUE`;
    return Prisma.sql`
      c."organization_id" = ${request.organizationId}::uuid
      AND dv."organization_id" = ${request.organizationId}::uuid
      AND s."organization_id" = ${request.organizationId}::uuid
      AND dv."status" = 'READY'
      AND (${sourceFilter})
      AND (${versionFilter})
      AND (${metadataFilter})
      AND (
        s."acl" = '{}'::jsonb OR s."acl"->>'public' = 'true'
        OR coalesce(s."acl"->'userIds', '[]'::jsonb) ? ${request.userId}
        OR EXISTS (
          SELECT 1 FROM "users" u
          WHERE u."id" = ${request.userId}::uuid
            AND u."organization_id" = s."organization_id"
            AND (
              u."role" IN ('ADMIN', 'MENTOR')
              OR coalesce(s."acl"->'roles', '[]'::jsonb) ? u."role"::text
            )
        )
      )
    `;
  }

  private mapRows(
    rows: DocumentCandidateRow[],
    channel: RetrievalChannel,
    hitReason: string,
  ): DocumentCandidate[] {
    return rows.map((row, index) => ({
      chunkId: row.chunkId,
      nodeId: row.nodeId,
      ...(row.parentId && { parentId: row.parentId }),
      documentId: row.documentId,
      documentVersionId: row.documentVersionId,
      version: String(row.version),
      organizationId: row.organizationId,
      sourceTitle: row.sourceTitle,
      sourceUri: row.sourceUri,
      content: row.content,
      sectionPath: Array.isArray(row.sectionPath)
        ? row.sectionPath.filter((value): value is string => typeof value === 'string')
        : [],
      locator: this.locator(row.locator),
      rawScore: row.score,
      rawRank: index + 1,
      channel,
      hitReason,
    }));
  }

  private locator(value: unknown): DocumentLocator {
    const locator =
      typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
    return {
      anchor: typeof locator['anchor'] === 'string' ? locator['anchor'] : 'document',
      startLine: typeof locator['startLine'] === 'number' ? locator['startLine'] : 1,
      endLine: typeof locator['endLine'] === 'number' ? locator['endLine'] : 1,
      ...(typeof locator['page'] === 'number' && { page: locator['page'] }),
    };
  }
}

@Injectable()
export class PrismaKeywordDocumentSearchAdapter implements IDocumentSearchChannel {
  constructor(private readonly store: PrismaDocumentSearchStore) {}
  search(request: DocumentSearchRequest): Promise<DocumentCandidate[]> {
    return this.store.keywordSearch(request);
  }
}

@Injectable()
export class PrismaVectorDocumentSearchAdapter implements IDocumentSearchChannel {
  constructor(private readonly store: PrismaDocumentSearchStore) {}
  search(request: DocumentSearchRequest): Promise<DocumentCandidate[]> {
    return this.store.vectorSearch(request);
  }
}

@Injectable()
export class PrismaDocumentExpansionAdapter implements IDocumentExpansionStore {
  constructor(private readonly store: PrismaDocumentSearchStore) {}
  expand(request: ExpansionRequest): Promise<DocumentCandidate[]> {
    return this.store.expand(request);
  }
}
