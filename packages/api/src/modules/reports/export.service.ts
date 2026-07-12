import { Injectable, BadRequestException } from '@nestjs/common';
import { IExportStrategy } from './strategies/export-strategy.interface';
import { CsvExportStrategy } from './strategies/csv-export.strategy';

@Injectable()
export class ExportService {
  private strategies = new Map<string, IExportStrategy>();

  constructor(csvExportStrategy: CsvExportStrategy) {
    // MVP: Only CSV is implemented
    this.strategies.set('csv', csvExportStrategy);
  }

  async export(
    format: string,
    data: Record<string, unknown>[],
    headers?: string[],
  ): Promise<Buffer | string> {
    const strategy = this.strategies.get(format.toLowerCase());
    if (!strategy) {
      throw new BadRequestException(`Export format '${format}' is not supported yet.`);
    }

    return strategy.export(data, headers);
  }
}
