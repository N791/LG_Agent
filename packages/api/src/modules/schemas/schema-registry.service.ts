import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class SchemaRegistryService {
  private readonly schemas = new Map<string, Record<string, unknown>>();

  registerSchema(name: string, schema: Record<string, unknown>) {
    const existing = this.schemas.get(name);
    if (existing && existing !== schema) {
      throw new ConflictException({
        message: 'errors.schema.conflict',
        args: { name },
      });
    }
    this.schemas.set(name, schema);
  }

  getSchema(name: string): Record<string, unknown> {
    const schema = this.schemas.get(name);
    if (!schema) {
      throw new NotFoundException({ message: 'errors.schema.notFound', args: { name } });
    }
    return schema;
  }

  getAllSchemas(): Record<string, Record<string, unknown>> {
    return Object.fromEntries(this.schemas);
  }
}
