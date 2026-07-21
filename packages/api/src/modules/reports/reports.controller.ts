import { Controller, Post, Body, Res, BadRequestException, UseGuards } from '@nestjs/common';
import { ExportService } from './export.service';
import { SubmissionsService } from '../submissions/submissions.service';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

export class ExportRequestDto {
  reportType!: string;
  format!: string; // 'csv', 'xlsx', 'pdf'
  filters?: Record<string, unknown>;
}

@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(
    private readonly exportService: ExportService,
    private readonly submissionsService: SubmissionsService,
  ) {}

  @Post('export')
  async exportReport(@Body() request: ExportRequestDto, @Res() res: Response) {
    const { reportType, format, filters } = request;

    if (reportType !== 'submissions') {
      throw new BadRequestException({
        message: 'errors.report.unsupportedType',
        args: { type: reportType },
      });
    }

    // Fetch data based on filters
    const submissions = await this.submissionsService.findAll(
      filters as { userId?: string; courseId?: string; taskId?: string },
    );

    // Transform data for export
    const exportData = submissions.map((sub) => ({
      ID: sub.id,
      Trainee: sub.user.username,
      Task: sub.task.title,
      Status: sub.status,
      Score: sub.score,
      Date: sub.createdAt.toISOString(),
    }));

    // Generate report
    const reportContent = await this.exportService.export(format, exportData);

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
