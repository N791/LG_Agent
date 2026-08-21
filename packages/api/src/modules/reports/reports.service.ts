import { Injectable } from '@nestjs/common';
import type { TenantActor } from '../../common/tenant/organization-scoped.repository';
import { SubmissionsService } from '../submissions';
import { ExportService } from './export.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly exporter: ExportService,
    private readonly submissions: SubmissionsService,
  ) {}

  async exportSubmissions(
    format: string,
    actor: TenantActor,
    filters?: Record<string, unknown>,
  ): Promise<Buffer | string> {
    const submissions = await this.submissions.findAll(
      actor,
      filters as { userId?: string; courseId?: string; taskId?: string },
    );
    return this.exporter.export(
      format,
      submissions.map((submission) => ({
        ID: submission.id,
        Trainee: submission.user.username,
        Task: submission.task.title,
        Status: submission.status,
        Score: submission.score,
        Date: submission.createdAt.toISOString(),
      })),
    );
  }
}
