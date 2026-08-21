import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../common/prisma.service';
import type { IDocumentIndexRepository } from './structured-document-index.service';

@Injectable()
export class PrismaDocumentIndexRepository implements IDocumentIndexRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isReady(
    organizationId: string,
    documentVersionId: string,
    chunkerVersion: string,
  ): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ ready: boolean }[]>(Prisma.sql`
      SELECT EXISTS (
        SELECT 1 FROM "document_versions"
        WHERE "id" = ${documentVersionId}::uuid
          AND "organization_id" = ${organizationId}::uuid
          AND "status" = 'READY'
          AND "metadata"->>'chunkerVersion' = ${chunkerVersion}
      ) AS "ready"
    `);
    return rows[0]?.ready ?? false;
  }

  async replaceBuildingIndex(
    input: Parameters<IDocumentIndexRepository['replaceBuildingIndex']>[0],
  ): Promise<void> {
    const operations: Prisma.PrismaPromise<unknown>[] = [
      this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM "document_chunks"
        WHERE "organization_id" = ${input.organizationId}::uuid
          AND "document_version_id" = ${input.documentVersionId}::uuid
          AND EXISTS (
            SELECT 1 FROM "document_versions"
            WHERE "id" = ${input.documentVersionId}::uuid AND "status" = 'BUILDING'
          )
      `),
      this.prisma.$executeRaw(Prisma.sql`
        DELETE FROM "document_nodes"
        WHERE "organization_id" = ${input.organizationId}::uuid
          AND "document_version_id" = ${input.documentVersionId}::uuid
          AND EXISTS (
            SELECT 1 FROM "document_versions"
            WHERE "id" = ${input.documentVersionId}::uuid AND "status" = 'BUILDING'
          )
      `),
    ];
    for (const node of input.nodes) {
      operations.push(
        this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "document_nodes" (
          "id", "organization_id", "document_version_id", "parent_id", "stable_key",
          "node_type", "title", "ordinal", "depth", "content", "section_path", "locator", "metadata"
        ) VALUES (
          ${node.id}::uuid, ${input.organizationId}::uuid, ${input.documentVersionId}::uuid,
          ${node.parentId ?? null}::uuid, ${node.id}, ${node.type}, ${node.title ?? null},
          ${node.ordinal}, ${node.depth}, ${node.content},
          ${JSON.stringify(node.sectionPath)}::jsonb, ${JSON.stringify(node.locator)}::jsonb,
          '{}'::jsonb
        )
      `),
      );
    }
    input.chunks.forEach((chunk, index) => {
      const embedding = input.embeddings[index];
      if (!embedding?.length || embedding.some((value) => !Number.isFinite(value))) {
        throw new Error(`Invalid embedding for document chunk ${chunk.id}.`);
      }
      operations.push(
        this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "document_chunks" (
          "id", "organization_id", "document_version_id", "node_id", "ordinal",
          "content", "content_hash", "token_count", "chunker_version", "embedding", "metadata"
        ) VALUES (
          ${chunk.id}::uuid, ${input.organizationId}::uuid, ${input.documentVersionId}::uuid,
          ${chunk.nodeId}::uuid, ${chunk.ordinal}, ${chunk.content}, ${chunk.contentHash},
          ${chunk.tokenCount}, ${input.chunkerVersion}, ${`[${embedding.join(',')}]`}::vector,
          ${JSON.stringify({
            parentId: chunk.parentId,
            sectionPath: chunk.sectionPath,
            locator: chunk.locator,
          })}::jsonb
        )
      `),
      );
    });
    await this.prisma.$transaction(operations);
  }

  async markReady(
    organizationId: string,
    documentVersionId: string,
    chunkerVersion: string,
  ): Promise<void> {
    const changed = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "document_versions"
      SET "status" = 'READY', "ready_at" = now(),
          "metadata" = "metadata" || ${JSON.stringify({ chunkerVersion })}::jsonb
      WHERE "id" = ${documentVersionId}::uuid
        AND "organization_id" = ${organizationId}::uuid
        AND "status" = 'BUILDING'
    `);
    if (changed !== 1) throw new Error('Document version is not a writable BUILDING boundary.');
  }

  async markFailed(
    organizationId: string,
    documentVersionId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "document_versions"
      SET "status" = 'FAILED',
          "metadata" = "metadata" || ${JSON.stringify({ indexFailure: reason })}::jsonb
      WHERE "id" = ${documentVersionId}::uuid
        AND "organization_id" = ${organizationId}::uuid
        AND "status" = 'BUILDING'
    `);
  }
}
