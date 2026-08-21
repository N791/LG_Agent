import { Injectable, OnModuleInit } from '@nestjs/common';
import { SchemaRegistryService } from '../schema-registry.service';
import { schemas } from '@lg-agent/contracts';

@Injectable()
export class FileSchemaRepository implements OnModuleInit {
  constructor(private readonly schemaRegistry: SchemaRegistryService) {}

  onModuleInit() {
    // JSON Schema $id is canonical; short keys remain read-only compatibility aliases.
    for (const [key, schema] of Object.entries(schemas)) {
      const schemaId = (schema as Record<string, unknown>)['$id'];
      if (typeof schemaId !== 'string' || !schemaId.trim()) {
        throw new Error(`Schema "${key}" has no canonical $id.`);
      }
      this.schemaRegistry.registerSchema(schemaId, schema);
      this.schemaRegistry.registerSchema(key, schema);
    }
  }
}
