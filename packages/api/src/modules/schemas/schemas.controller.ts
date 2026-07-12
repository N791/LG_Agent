import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { SchemaRegistryService } from './schema-registry.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('v1/schemas')
@UseGuards(JwtAuthGuard)
export class SchemasController {
  constructor(private readonly schemaRegistry: SchemaRegistryService) {}

  @Get()
  getAllSchemas() {
    return this.schemaRegistry.getAllSchemas();
  }

  @Get(':name')
  getSchema(@Param('name') name: string) {
    return this.schemaRegistry.getSchema(name);
  }
}
