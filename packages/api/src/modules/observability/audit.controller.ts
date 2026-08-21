import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';

@Controller('observability')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @RequirePermission(PERMISSIONS.OBSERVABILITY_READ)
  @Get('audit')
  async getAuditLogs(@Request() request: { user: TenantActor }, @Query('limit') limit?: string) {
    return this.prisma.auditEvent.findMany({
      where: {
        organizationId: request.user.organizationId,
      },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 100,
      include: {
        actor: { select: { username: true, email: true } },
      },
    });
  }
}
