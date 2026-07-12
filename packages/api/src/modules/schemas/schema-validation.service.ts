import { Injectable, OnModuleInit, BadRequestException } from '@nestjs/common';
import { SchemaRegistryService } from './schema-registry.service';
import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';

@Injectable()
export class SchemaValidationService implements OnModuleInit {
  private ajv: Ajv;
  private validators: Map<string, ValidateFunction> = new Map();

  constructor(private readonly schemaRegistry: SchemaRegistryService) {
    this.ajv = new Ajv({ allErrors: true, useDefaults: true });
    addFormats(this.ajv);
  }

  onModuleInit() {
    const schemas = this.schemaRegistry.getAllSchemas();
    for (const [name, schema] of Object.entries(schemas)) {
      this.validators.set(name, this.ajv.compile(schema));
    }
  }

  validate(schemaName: string, data: unknown): void {
    const validator = this.validators.get(schemaName);
    if (!validator) {
      // If validator not compiled yet, compile it dynamically
      const schema = this.schemaRegistry.getSchema(schemaName);
      const newValidator = this.ajv.compile(schema);
      this.validators.set(schemaName, newValidator);
      
      if (!newValidator(data)) {
        throw new BadRequestException({
          message: `Validation failed for schema '${schemaName}'`,
          errors: newValidator.errors,
        });
      }
      return;
    }

    if (!validator(data)) {
      throw new BadRequestException({
        message: `Validation failed for schema '${schemaName}'`,
        errors: validator.errors,
      });
    }
  }
}
