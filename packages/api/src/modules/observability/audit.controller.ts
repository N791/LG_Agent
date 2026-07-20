import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('observability')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @UseGuards(JwtAuthGuard)
  @Get('audit')
  async getAuditLogs(@Query('limit') limit?: string) {
    return this.prisma.auditEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 100,
      include: {
        actor: { select: { username: true, email: true } },
      },
    });
  }
}
