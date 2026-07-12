import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class SchemaRegistryService {
  private schemas: Map<string, Record<string, unknown>> = new Map();

  registerSchema(name: string, schema: Record<string, unknown>) {
    this.schemas.set(name, schema);
  }

  getSchema(name: string): Record<string, unknown> {
    const schema = this.schemas.get(name);
    if (!schema) {
      throw new NotFoundException(`Schema '${name}' not found`);
    }
    return schema;
  }

  getAllSchemas(): Record<string, Record<string, unknown>> {
    return Object.fromEntries(this.schemas);
  }
}
