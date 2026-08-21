import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  IndexJobStatusDTO,
  RetrievalErrorCodeDTO,
  type CitationDTO,
  type CitationOpenResponseDTO,
  type RetrievalIndexItemDTO,
} from '@lg-agent/contracts';
import { PrismaService } from '../../../common/prisma.service';
import type { TenantActor } from '../../../common/tenant/organization-scoped.repository';
import { IndexJobObservabilityService } from './index-job-observability.service';

@Injectable()
export class RetrievalUxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: IndexJobObservabilityService,
  ) {}

  async openCitation(citation: CitationDTO, actor: TenantActor): Promise<CitationOpenResponseDTO> {
    if (citation.organizationId !== actor.organizationId) {
      return this.denied(citation);
    }
    if (citation.documentVersionId) {
      const version = await this.prisma.documentVersion.findFirst({
        where: {
          id: citation.documentVersionId,
          organizationId: actor.organizationId,
          status: 'READY',
        },
        include: { source: true },
      });
      if (!version || !this.canRead(version.source.acl, actor)) return this.denied(citation);
      const chunk = citation.chunkId
        ? await this.prisma.documentChunk.findFirst({
            where: {
              id: citation.chunkId,
              documentVersionId: version.id,
              organizationId: actor.organizationId,
            },
          })
        : undefined;
      return {
        available: true,
        citation,
        content: chunk?.content ?? 'The cited document version is available.',
      };
    }
    if (citation.repositorySnapshotId) {
      const snapshot = await this.prisma.repositorySnapshot.findFirst({
        where: {
          id: citation.repositorySnapshotId,
          organizationId: actor.organizationId,
          status: 'READY',
        },
      });
      if (!snapshot || !this.canRead(snapshot.acl, actor)) return this.denied(citation);
      const symbol = citation.symbolId
        ? await this.prisma.codeSymbol.findFirst({
            where: {
              id: citation.symbolId,
              repositorySnapshotId: snapshot.id,
              organizationId: actor.organizationId,
            },
          })
        : undefined;
      const metadata = symbol?.metadata as Record<string, unknown> | undefined;
      return {
        available: true,
        citation,
        content:
          (metadata?.['content'] as string | undefined) ??
          (symbol
            ? `${symbol.path}:${String(symbol.startLine)}-${String(symbol.endLine)} ${symbol.qualifiedName}`
            : 'The cited repository snapshot is available.'),
      };
    }
    return this.denied(citation, RetrievalErrorCodeDTO.SOURCE_NOT_FOUND);
  }

  async listIndexes(actor: TenantActor): Promise<RetrievalIndexItemDTO[]> {
    const [documents, snapshots] = await Promise.all([
      this.prisma.documentVersion.findMany({
        where: { organizationId: actor.organizationId },
        include: { source: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      this.prisma.repositorySnapshot.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return [
      ...documents.map((item) => {
        const metadata = item.metadata as Record<string, unknown>;
        const progress = this.jobs.get(item.id, actor.organizationId);
        return {
          id: item.id,
          kind: 'DOCUMENT' as const,
          sourceId: item.sourceId,
          sourceName: item.source.title,
          revision: `v${String(item.version)}`,
          status: item.status as IndexJobStatusDTO,
          active: metadata['active'] === true,
          ...(typeof metadata['indexFailure'] === 'string' && {
            failureReason: metadata['indexFailure'],
          }),
          createdAt: item.createdAt.toISOString(),
          ...(item.readyAt && { readyAt: item.readyAt.toISOString() }),
          ...(progress && {
            progress: progress.progress,
            retryCount: progress.retryCount,
            contentHash: progress.contentHash,
            indexVersion: progress.indexVersion,
            buildDurationMs: progress.buildDurationMs,
          }),
        };
      }),
      ...snapshots.map((item) => {
        const metadata = item.metadata as Record<string, unknown>;
        const progress = this.jobs.get(item.id, actor.organizationId);
        return {
          id: item.id,
          kind: 'CODE' as const,
          sourceId: item.repositoryId,
          sourceName: item.repositoryId,
          revision: item.commitSha,
          status: item.status as IndexJobStatusDTO,
          active: metadata['active'] === true,
          ...(typeof metadata['indexFailure'] === 'string' && {
            failureReason: metadata['indexFailure'],
          }),
          createdAt: item.createdAt.toISOString(),
          ...(item.readyAt && { readyAt: item.readyAt.toISOString() }),
          ...(progress && {
            progress: progress.progress,
            retryCount: progress.retryCount,
            contentHash: progress.contentHash,
            indexVersion: progress.indexVersion,
            buildDurationMs: progress.buildDurationMs,
          }),
        };
      }),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async activateIndex(kind: 'DOCUMENT' | 'CODE', id: string, actor: TenantActor): Promise<void> {
    if (kind === 'DOCUMENT') {
      const target = await this.prisma.documentVersion.findFirstOrThrow({
        where: { id, organizationId: actor.organizationId, status: 'READY' },
      });
      const siblings = await this.prisma.documentVersion.findMany({
        where: { organizationId: actor.organizationId, sourceId: target.sourceId },
      });
      await this.prisma.$transaction([
        ...siblings.map((item) =>
          this.prisma.documentVersion.update({
            where: { id: item.id },
            data: { metadata: { ...(item.metadata as object), active: false } },
          }),
        ),
        this.prisma.documentVersion.update({
          where: { id },
          data: { metadata: { ...(target.metadata as object), active: true } },
        }),
      ]);
      return;
    }
    const target = await this.prisma.repositorySnapshot.findFirstOrThrow({
      where: { id, organizationId: actor.organizationId, status: 'READY' },
    });
    const siblings = await this.prisma.repositorySnapshot.findMany({
      where: { organizationId: actor.organizationId, repositoryId: target.repositoryId },
    });
    await this.prisma.$transaction([
      ...siblings.map((item) =>
        this.prisma.repositorySnapshot.update({
          where: { id: item.id },
          data: { metadata: { ...(item.metadata as object), active: false } },
        }),
      ),
      this.prisma.repositorySnapshot.update({
        where: { id },
        data: { metadata: { ...(target.metadata as object), active: true } },
      }),
    ]);
  }

  async retryIndex(kind: 'DOCUMENT' | 'CODE', id: string, actor: TenantActor): Promise<void> {
    const retryRequestedAt = new Date().toISOString();
    if (kind === 'DOCUMENT') {
      const target = await this.prisma.documentVersion.findFirstOrThrow({
        where: { id, organizationId: actor.organizationId, status: 'FAILED' },
      });
      await this.prisma.documentVersion.update({
        where: { id },
        data: {
          status: 'BUILDING',
          metadata: {
            ...(target.metadata as object),
            indexFailure: null,
            retryRequestedAt,
            retryCount: Number((target.metadata as Record<string, unknown>)['retryCount'] ?? 0) + 1,
          },
        },
      });
      return;
    }
    const target = await this.prisma.repositorySnapshot.findFirstOrThrow({
      where: { id, organizationId: actor.organizationId, status: 'FAILED' },
    });
    await this.prisma.repositorySnapshot.update({
      where: { id },
      data: {
        status: 'BUILDING',
        metadata: {
          ...(target.metadata as object),
          indexFailure: null,
          retryRequestedAt,
          retryCount: Number((target.metadata as Record<string, unknown>)['retryCount'] ?? 0) + 1,
        },
      },
    });
  }

  private canRead(aclValue: Prisma.JsonValue, actor: TenantActor): boolean {
    const acl = (aclValue ?? {}) as Record<string, unknown>;
    const users = Array.isArray(acl['userIds']) ? (acl['userIds'] as string[]) : [];
    const roles = Array.isArray(acl['roles']) ? (acl['roles'] as string[]) : [];
    return (
      Object.keys(acl).length === 0 ||
      acl['public'] === true ||
      users.includes(actor.id) ||
      roles.includes(actor.role)
    );
  }

  private denied(
    citation: CitationDTO,
    errorCode = RetrievalErrorCodeDTO.ACCESS_DENIED,
  ): CitationOpenResponseDTO {
    return {
      available: false,
      citation,
      errorCode,
      recovery:
        errorCode === RetrievalErrorCodeDTO.ACCESS_DENIED
          ? 'Request access from the source owner.'
          : 'Refresh the answer or select another indexed source.',
    };
  }
}
