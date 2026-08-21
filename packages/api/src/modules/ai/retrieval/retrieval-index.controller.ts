import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PERMISSIONS } from '@lg-agent/contracts';
import type { TenantActor } from '../../../common/tenant/organization-scoped.repository';
import { PrismaService } from '../../../common/prisma.service';
import { RequirePermission } from '../../authorization';
import { StructuredDocumentIndexService } from './document/structured-document-index.service';
import { IndexJobObservabilityService } from './index-job-observability.service';
import { RepositoryCodeIndexService } from './code';
import type { RepositorySourceFile } from './code';

interface AuthenticatedRequest {
  user: TenantActor;
}

interface DocumentIndexRequest {
  documentVersionId: string;
  markdown: string;
}

interface RepositorySnapshotRequest {
  commitSha: string;
  defaultBranch?: string;
  files: RepositorySourceFile[];
}

@ApiTags('Retrieval indexing')
@Controller('ai')
export class RetrievalIndexController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly documents: StructuredDocumentIndexService,
    private readonly code: RepositoryCodeIndexService,
    private readonly jobs: IndexJobObservabilityService,
  ) {}

  @Post('knowledge/sources/:id/index')
  @RequirePermission(PERMISSIONS.KNOWLEDGE_MANAGE)
  @ApiOperation({ summary: 'Create or reuse an index for a knowledge source version' })
  async indexKnowledgeSource(
    @Req() request: AuthenticatedRequest,
    @Param('id') sourceId: string,
    @Body() body: DocumentIndexRequest,
  ) {
    if (!body.documentVersionId || !body.markdown.trim()) {
      throw new BadRequestException('documentVersionId and markdown are required');
    }
    const version = await this.prisma.documentVersion.findFirst({
      where: {
        id: body.documentVersionId,
        sourceId,
        organizationId: request.user.organizationId,
        source: { organizationId: request.user.organizationId },
      },
      select: { id: true },
    });
    if (!version) throw new NotFoundException('Knowledge source version was not found');
    return this.documents.index({
      organizationId: request.user.organizationId,
      documentVersionId: version.id,
      markdown: body.markdown,
    });
  }

  @Get('knowledge/index-jobs/:id')
  @RequirePermission(PERMISSIONS.KNOWLEDGE_READ)
  @ApiOperation({ summary: 'Get a tenant-scoped knowledge index job' })
  getKnowledgeIndexJob(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const job = this.jobs.get(id, request.user.organizationId);
    if (job?.kind !== 'DOCUMENT') throw new NotFoundException('Index job was not found');
    return job;
  }

  @Post('code/repositories/:id/snapshots')
  @RequirePermission(PERMISSIONS.AI_RETRIEVAL_MANAGE)
  @ApiOperation({ summary: 'Create or reuse an immutable repository snapshot index' })
  async indexRepository(
    @Req() request: AuthenticatedRequest,
    @Param('id') repositoryId: string,
    @Body() body: RepositorySnapshotRequest,
  ) {
    if (!body.commitSha || !Array.isArray(body.files)) {
      throw new BadRequestException('commitSha and files are required');
    }
    const repository = await this.prisma.codeRepository.findFirst({
      where: { id: repositoryId, organizationId: request.user.organizationId },
      select: { id: true, name: true, canonicalUri: true, acl: true },
    });
    if (!repository) throw new NotFoundException('Code repository was not found');
    return this.code.index({
      organizationId: request.user.organizationId,
      repositoryId: repository.id,
      repositoryName: repository.name,
      canonicalUri: repository.canonicalUri,
      commitSha: body.commitSha,
      ...(body.defaultBranch && { defaultBranch: body.defaultBranch }),
      acl: repository.acl as Record<string, unknown>,
      files: body.files,
    });
  }

  @Get('code/snapshots/:id')
  @RequirePermission(PERMISSIONS.AI_RETRIEVAL_READ)
  @ApiOperation({ summary: 'Get immutable repository snapshot readiness and index counts' })
  async getRepositorySnapshot(@Req() request: AuthenticatedRequest, @Param('id') id: string) {
    const snapshot = await this.prisma.repositorySnapshot.findFirst({
      where: { id, organizationId: request.user.organizationId },
      select: {
        id: true,
        repositoryId: true,
        commitSha: true,
        status: true,
        defaultBranch: true,
        createdAt: true,
        readyAt: true,
        _count: { select: { files: true, symbols: true, relations: true } },
      },
    });
    if (!snapshot) throw new NotFoundException('Repository snapshot was not found');
    return {
      ...snapshot,
      createdAt: snapshot.createdAt.toISOString(),
      readyAt: snapshot.readyAt?.toISOString(),
      fileCount: snapshot._count.files,
      symbolCount: snapshot._count.symbols,
      relationCount: snapshot._count.relations,
      _count: undefined,
    };
  }
}
