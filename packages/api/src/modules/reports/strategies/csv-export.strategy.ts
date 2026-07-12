import { IExportStrategy } from './export-strategy.interface';
import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';

@Injectable()
export class CsvExportStrategy implements IExportStrategy {
  export(data: Record<string, unknown>[], headers?: string[]): Promise<Buffer | string> {
    if (data.length === 0) {
      return Promise.resolve(headers ? headers.join(',') + '\n' : '');
    }

    const csvOptions = headers ? { columns: headers, header: true } : { header: true };
    return Promise.resolve(stringify(data, csvOptions));
  }
}
