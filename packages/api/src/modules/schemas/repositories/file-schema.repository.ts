import { Injectable, OnModuleInit } from '@nestjs/common';
import { SchemaRegistryService } from '../schema-registry.service';
import { schemas } from '@lg-agent/contracts';

@Injectable()
export class FileSchemaRepository implements OnModuleInit {
  constructor(private readonly schemaRegistry: SchemaRegistryService) {}

  onModuleInit() {
    // Register all schemas from @lg-agent/contracts
    for (const [key, schema] of Object.entries(schemas)) {
      this.schemaRegistry.registerSchema(key, schema);
    }
  }
}
