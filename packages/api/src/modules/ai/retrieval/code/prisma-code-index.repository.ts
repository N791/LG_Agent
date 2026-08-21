import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma.service';
import { stableRetrievalId } from '../document/stable-id';
import type { ParsedCodeFile } from './code-intelligence.types';
import type { ICodeIndexRepository } from './code-index.service';

interface ReusableRow {
  artifact: ParsedCodeFile;
}

@Injectable()
export class PrismaCodeIndexRepository implements ICodeIndexRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ensureSnapshot(
    input: Parameters<ICodeIndexRepository['ensureSnapshot']>[0],
  ): Promise<void> {
    const codeRepositoryId = stableRetrievalId(
      'code-repository-v1',
      input.organizationId,
      input.repositoryId,
    );
    await this.prisma.$transaction([
      this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "code_repositories" (
          "id", "organization_id", "external_key", "name", "canonical_uri", "acl", "updated_at"
        ) VALUES (
          ${codeRepositoryId}::uuid, ${input.organizationId}::uuid, ${input.repositoryId},
          ${input.repositoryName}, ${input.canonicalUri}, ${JSON.stringify(input.acl)}::jsonb, now()
        )
        ON CONFLICT ("organization_id", "external_key") DO UPDATE SET
          "name" = EXCLUDED."name",
          "canonical_uri" = EXCLUDED."canonical_uri",
          "acl" = EXCLUDED."acl",
          "updated_at" = now()
      `),
      this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "repository_snapshots" (
          "id", "organization_id", "repository_id", "code_repository_id", "commit_sha",
          "default_branch", "acl", "metadata"
        ) VALUES (
          ${input.id}::uuid, ${input.organizationId}::uuid, ${input.repositoryId},
          ${codeRepositoryId}::uuid, ${input.commitSha}, ${input.defaultBranch ?? null},
          ${JSON.stringify(input.acl)}::jsonb, '{}'::jsonb
        )
        ON CONFLICT ("organization_id", "repository_id", "commit_sha") DO NOTHING
      `),
    ]);
  }

  async isReady(
    organizationId: string,
    repositorySnapshotId: string,
    parserVersion: string,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ ready: boolean }[]>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM "repository_snapshots"
        WHERE "id" = ${repositorySnapshotId}::uuid
          AND "organization_id" = ${organizationId}::uuid
          AND "status" = 'READY'
          AND "metadata"->>'parserVersion' = ${parserVersion}
      ) AS "ready"
    `);
    return rows[0]?.ready ?? false;
  }

  async findReusableFile(
    input: Parameters<ICodeIndexRepository['findReusableFile']>[0],
  ): Promise<ParsedCodeFile | undefined> {
    const rows = await this.prisma.$queryRaw<ReusableRow[]>(Prisma.sql`
      SELECT cf."metadata"->'parserArtifact' AS "artifact"
      FROM "code_files" cf
      JOIN "repository_snapshots" rs ON rs."id" = cf."repository_snapshot_id"
      WHERE cf."organization_id" = ${input.organizationId}::uuid
        AND rs."repository_id" = ${input.repositoryId}
        AND rs."status" = 'READY'
        AND cf."path" = ${input.path}
        AND cf."content_hash" = ${input.contentHash}
        AND cf."parser_version" = ${input.parserVersion}
        AND cf."metadata" ? 'parserArtifact'
      ORDER BY rs."created_at" DESC
      LIMIT 1
    `);
    return rows[0]?.artifact;
  }

  async replaceBuildingIndex(
    input: Parameters<ICodeIndexRepository['replaceBuildingIndex']>[0],
  ): Promise<void> {
    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM "code_relations"
        WHERE "organization_id" = ${input.organizationId}::uuid
          AND "repository_snapshot_id" = ${input.repositorySnapshotId}::uuid
          AND EXISTS (
            SELECT 1 FROM "repository_snapshots"
            WHERE "id" = ${input.repositorySnapshotId}::uuid AND "status" = 'BUILDING'
          )
      `),
      this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM "code_symbols"
        WHERE "organization_id" = ${input.organizationId}::uuid
          AND "repository_snapshot_id" = ${input.repositorySnapshotId}::uuid
          AND EXISTS (
            SELECT 1 FROM "repository_snapshots"
            WHERE "id" = ${input.repositorySnapshotId}::uuid AND "status" = 'BUILDING'
          )
      `),
      this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM "code_files"
        WHERE "organization_id" = ${input.organizationId}::uuid
          AND "repository_snapshot_id" = ${input.repositorySnapshotId}::uuid
          AND EXISTS (
            SELECT 1 FROM "repository_snapshots"
            WHERE "id" = ${input.repositorySnapshotId}::uuid AND "status" = 'BUILDING'
          )
      `),
    ];
    const sourceByPath = new Map(
      input.sourceFiles.map((file) => [
        file.path.replaceAll('\\', '/').replace(/^\.\/+/, ''),
        file,
      ]),
    );
    for (const file of input.index.files) {
      const source = sourceByPath.get(file.path);
      operations.push(
        this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "code_files" (
          "id", "organization_id", "repository_snapshot_id", "path", "language",
          "content", "content_hash", "parser_version", "parse_confidence",
          "fallback_reason", "generated", "metadata"
        ) VALUES (
          ${stableRetrievalId('code-file-v1', input.repositorySnapshotId, file.path)}::uuid,
          ${input.organizationId}::uuid, ${input.repositorySnapshotId}::uuid, ${file.path},
          ${file.language}, ${source?.content ?? file.symbols[0]?.content ?? ''}, ${file.contentHash},
          ${file.parserVersion}, ${file.parseConfidence}, ${file.fallbackReason ?? null},
          ${source?.generated ?? false},
          ${JSON.stringify({ parserArtifact: file })}::jsonb
        )
      `),
      );
    }
    for (const symbol of input.index.symbols) {
      operations.push(
        this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "code_symbols" (
          "id", "organization_id", "repository_snapshot_id", "stable_key", "name",
          "qualified_name", "kind", "path", "start_line", "end_line", "signature",
          "content_hash", "metadata"
        ) VALUES (
          ${symbol.id}::uuid, ${input.organizationId}::uuid,
          ${input.repositorySnapshotId}::uuid, ${symbol.stableKey}, ${symbol.name},
          ${symbol.qualifiedName}, ${symbol.kind}, ${symbol.path}, ${symbol.startLine},
          ${symbol.endLine}, ${symbol.signature ?? null},
          ${input.index.files.find(({ path }) => path === symbol.path)?.contentHash ?? ''},
          ${JSON.stringify({
            language: symbol.language,
            docComment: symbol.docComment,
            summary: symbol.summary,
            parentId: symbol.parentId,
            content: symbol.content,
            parseConfidence: symbol.parseConfidence,
            fallbackReason: input.index.files.find(({ path }) => path === symbol.path)
              ?.fallbackReason,
          })}::jsonb
        )
      `),
      );
    }
    for (const relation of input.index.relations) {
      operations.push(
        this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "code_relations" (
          "id", "organization_id", "repository_snapshot_id", "source_symbol_id",
          "target_symbol_id", "relation_type", "metadata"
        ) VALUES (
          ${relation.id}::uuid, ${input.organizationId}::uuid,
          ${input.repositorySnapshotId}::uuid, ${relation.sourceSymbolId}::uuid,
          ${relation.targetSymbolId}::uuid, ${relation.relationType}::"CodeRelationType",
          ${JSON.stringify({
            confidence: relation.confidence,
            heuristic: relation.heuristic,
          })}::jsonb
        )
      `),
      );
    }
    await this.prisma.$transaction(operations);
  }

  async markReady(
    organizationId: string,
    repositorySnapshotId: string,
    parserVersion: string,
  ): Promise<void> {
    const changed = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "repository_snapshots"
      SET "status" = 'READY', "ready_at" = now(),
          "metadata" = "metadata" || ${JSON.stringify({ parserVersion })}::jsonb
      WHERE "id" = ${repositorySnapshotId}::uuid
        AND "organization_id" = ${organizationId}::uuid
        AND "status" = 'BUILDING'
    `);
    if (changed !== 1) throw new Error('Repository snapshot is not a writable BUILDING boundary.');
  }

  async markFailed(
    organizationId: string,
    repositorySnapshotId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "repository_snapshots"
      SET "status" = 'FAILED',
          "metadata" = "metadata" || ${JSON.stringify({ indexFailure: reason })}::jsonb
      WHERE "id" = ${repositorySnapshotId}::uuid
        AND "organization_id" = ${organizationId}::uuid
        AND "status" = 'BUILDING'
    `);
  }
}
