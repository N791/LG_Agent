import { Injectable, PipeTransform, mixin, Type } from '@nestjs/common';
import { SchemaValidationService } from './schema-validation.service';

/**
 * A generic pipe to validate DTO fields against JSON schemas.
 * 
 * Usage:
 * @UsePipes(SchemaValidationPipe({ envConfig: 'lg-agent:schema:env', promptConfig: 'lg-agent:schema:prompt' }))
 */
export function SchemaValidationPipe(schemaMapping: Record<string, string>): Type<PipeTransform> {
  @Injectable()
  class MixinSchemaValidationPipe implements PipeTransform {
    constructor(private readonly validationService: SchemaValidationService) {}

    transform(value: unknown) {
      if (value && typeof value === 'object') {
        const obj = value as Record<string, unknown>;
        for (const [field, schemaName] of Object.entries(schemaMapping)) {
          if (obj[field] !== undefined && obj[field] !== null) {
            this.validationService.validate(schemaName, obj[field]);
          }
        }
      }
      return value;
    }
  }

  return mixin(MixinSchemaValidationPipe);
}

