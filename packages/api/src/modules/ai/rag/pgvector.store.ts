import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../common/prisma.service';
import { DocumentChunk } from './markdown-chunker';
import { IVectorStore, SearchResult } from './interfaces';

interface VectorSearchRow {
  id: string;
  content: string;
  metadata: unknown;
  score: number;
}

@Injectable()
export class PgVectorStore implements IVectorStore {
  constructor(private readonly prisma: PrismaService) {}

  async addDocuments(chunks: DocumentChunk[], vectors: number[][]): Promise<void> {
    if (chunks.length !== vectors.length) {
      throw new Error('Mismatch between chunks and vectors length');
    }
    await this.prisma.$transaction(
      chunks.map((chunk, index) => {
        const vector = vectors[index];
        if (!vector) throw new Error(`Missing embedding for chunk ${chunk.id}`);
        const sourceValue = chunk.metadata?.['source'];
        const source = typeof sourceValue === 'string' ? sourceValue : 'unknown';
        return this.prisma.$executeRaw(Prisma.sql`
          INSERT INTO "knowledge_vectors" ("id", "source", "content", "metadata", "embedding")
          VALUES (
            ${chunk.id},
            ${source},
            ${chunk.content},
            ${JSON.stringify(chunk.metadata ?? {})}::jsonb,
            ${this.serialize(vector)}::vector
          )
          ON CONFLICT ("id") DO UPDATE SET
            "source" = EXCLUDED."source",
            "content" = EXCLUDED."content",
            "metadata" = EXCLUDED."metadata",
            "embedding" = EXCLUDED."embedding",
            "created_at" = now()
        `);
      }),
    );
  }

  async search(queryVector: number[], topK = 3): Promise<SearchResult[]> {
    const rows = await this.prisma.$queryRaw<VectorSearchRow[]>(Prisma.sql`
      SELECT
        "id",
        "content",
        "metadata",
        1 - ("embedding" <=> ${this.serialize(queryVector)}::vector) AS "score"
      FROM "knowledge_vectors"
      ORDER BY "embedding" <=> ${this.serialize(queryVector)}::vector
      LIMIT ${topK}
    `);
    return rows.map((row) => ({
      chunk: {
        id: row.id,
        content: row.content,
        metadata: (row.metadata as Record<string, unknown> | null) ?? {},
      },
      score: row.score,
    }));
  }

  async deleteBySource(source: string): Promise<void> {
    await this.prisma.$executeRaw(
      Prisma.sql`DELETE FROM "knowledge_vectors" WHERE "source" = ${source}`,
    );
  }

  async reset(): Promise<void> {
    await this.prisma.$executeRaw(Prisma.sql`TRUNCATE TABLE "knowledge_vectors"`);
  }

  private serialize(vector: number[]): string {
    if (vector.length === 0 || vector.some((value) => !Number.isFinite(value))) {
      throw new Error('Embedding must contain finite numeric values');
    }
    return `[${vector.join(',')}]`;
  }
}
