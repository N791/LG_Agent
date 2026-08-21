import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../../common/prisma.service';
import { Public } from '../../auth/decorators/public.decorator';
import {
  AUTHORIZATION_REGISTRY_MISMATCH_CODE,
  AuthorizationRegistryService,
} from '../../authorization';
import { ConfigService } from '@nestjs/config';
import { resolveStarterTemplate, SCHEMA_IDS } from '@lg-agent/contracts';
import { SchemaRegistryService } from '../../schemas';

const GOLDEN_TASK_ID = '00000000-0000-0000-0000-000000000002';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prisma: PrismaHealthIndicator,
    private prismaService: PrismaService,
    private registry: AuthorizationRegistryService,
    private config: ConfigService,
    private schemas: SchemaRegistryService,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.pingCheck('database', this.prismaService),
      // Future: add Redis ping check here
    ]);
  }

  @Get('ready')
  @Public()
  async ready() {
    const registry = await this.registry.refreshStatus();
    if (!registry.ready) {
      throw new ServiceUnavailableException({
        code: AUTHORIZATION_REGISTRY_MISMATCH_CODE,
        message: 'Permission registry reconciliation is required before this release can serve.',
        registry,
      });
    }
    return {
      status: 'ok',
      info: {
        permissionRegistry: {
          status: 'up',
          version: registry.actualVersion,
          digest: registry.actualDigest,
        },
      },
    };
  }

  @Get('golden-path-ready')
  @Public()
  async goldenPathReady() {
    const task = await this.prismaService.task.findUnique({
      where: { id: GOLDEN_TASK_ID },
      include: { course: { select: { organizationId: true } } },
    });
    const template = task
      ? resolveStarterTemplate(task.sandboxConfig, task.envConfig).template
      : null;
    const versions = task
      ? await this.prismaService.documentVersion.findMany({
          where: { organizationId: task.course.organizationId, status: 'READY' },
          select: { id: true, metadata: true },
        })
      : [];
    const activeRetrieval = versions.find((version) => {
      const metadata = version.metadata as Record<string, unknown>;
      return metadata['taskId'] === GOLDEN_TASK_ID && metadata['active'] === true;
    });
    const schemaIds = Object.values(SCHEMA_IDS);
    const schemaRegistryReady = schemaIds.every((id) => {
      try {
        return this.schemas.getSchema(id)['$id'] === id;
      } catch {
        return false;
      }
    });
    const provider = this.config.get<string>('LLM_PROVIDER', '');
    const nodeImage = this.config.get<string>('SANDBOX_NODE_IMAGE', '');
    const registry = await this.registry.refreshStatus();
    const checks = {
      nodeRuntime: nodeImage.includes('node:20'),
      schemaRegistry: schemaRegistryReady,
      starterTemplate: Boolean(
        template?.contentHash && template.entry === 'index.js' && template.files.length >= 3,
      ),
      retrievalActiveVersion: Boolean(activeRetrieval),
      llmProvider: Boolean(provider && provider !== 'mock'),
      permissionRegistry: registry.ready,
    };
    if (Object.values(checks).some((ready) => !ready)) {
      throw new ServiceUnavailableException({
        code: 'GOLDEN_PATH_NOT_READY',
        message: 'Staging Golden Path readiness checks failed.',
        checks,
        templateHash: template?.contentHash ?? null,
        activeRetrievalVersion: activeRetrieval?.id ?? null,
      });
    }
    return {
      status: 'ok',
      checks,
      templateHash: template?.contentHash,
      activeRetrievalVersion: activeRetrieval?.id,
    };
  }
}
