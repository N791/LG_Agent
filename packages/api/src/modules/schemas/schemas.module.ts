import { Module, Global } from '@nestjs/common';
import { SchemaRegistryService } from './schema-registry.service';
import { FileSchemaRepository } from './repositories/file-schema.repository';
import { SchemaValidationService } from './schema-validation.service';
import { SchemasController } from './schemas.controller';

@Global()
@Module({
  controllers: [SchemasController],
  providers: [
    SchemaRegistryService,
    FileSchemaRepository,
    SchemaValidationService,
  ],
  exports: [SchemaRegistryService, SchemaValidationService],
})
export class SchemasModule {}
