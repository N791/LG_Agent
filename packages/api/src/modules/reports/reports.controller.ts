import {
  Controller,
  Post,
  Body,
  Res,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReportsService } from './reports.service';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { PERMISSIONS } from '@lg-agent/contracts';
import { RequirePermission } from '../authorization';

export class ExportRequestDto {
  reportType!: string;
  format!: string; // 'csv', 'xlsx', 'pdf'
  filters?: Record<string, unknown>;
}

@Controller('reports')
@UseGuards(JwtAuthGuard)
@RequirePermission(PERMISSIONS.ANALYTICS_READ)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post('export')
  async exportReport(
    @Body() request: ExportRequestDto,
    @Request() req: { user: TenantActor },
    @Res() res: Response,
  ) {
    const { reportType, format, filters } = request;

    if (reportType !== 'submissions') {
      throw new BadRequestException({
        message: 'errors.report.unsupportedType',
        args: { type: reportType },
      });
    }

    const reportContent = await this.reports.exportSubmissions(format, req.user, filters);

    // Set response headers and send
    const ext = format.toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${reportType}_export_${timestamp}.${ext}`;

    if (ext === 'csv') {
      res.header('Content-Type', 'text/csv');
      res.header('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(reportContent);
    }

    // Fallback for other formats in the future
    res.header('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(reportContent);
  }
}
