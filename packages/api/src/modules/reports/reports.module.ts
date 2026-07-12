import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ExportService } from './export.service';
import { CsvExportStrategy } from './strategies/csv-export.strategy';
import { SubmissionsModule } from '../submissions/submissions.module';

@Module({
  imports: [SubmissionsModule],
  controllers: [ReportsController],
  providers: [ExportService, CsvExportStrategy],
})
export class ReportsModule {}
