import { Controller, Get, Query, Request } from '@nestjs/common';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../../authorization';
import type { TenantActor } from '../../../common/tenant/organization-scoped.repository';
import { AiAuditService } from './ai-audit.service';

@Controller('ai/audit')
@RequirePermission(PERMISSIONS.OBSERVABILITY_READ)
export class AiAuditController {
  constructor(private readonly audit: AiAuditService) {}

  @Get('requests')
  listRequests(@Request() request: { user: TenantActor }, @Query('limit') limit?: string) {
    const parsedLimit = limit ? Number.parseInt(limit, 10) : 100;
    return this.audit.listForOrganization(
      request.user.organizationId,
      Number.isFinite(parsedLimit) ? parsedLimit : 100,
    );
  }
}
