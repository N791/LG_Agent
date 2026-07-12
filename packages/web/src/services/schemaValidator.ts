import Ajv, { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { schemasService } from './schemas';

class SchemaValidatorService {
  private ajv: Ajv;
  private validators = new Map<string, ValidateFunction>();
  private isInitialized = false;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, useDefaults: true });
    addFormats(this.ajv);
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      const allSchemas = await schemasService.getAllSchemas();
      Object.entries(allSchemas).forEach(([name, schema]) => {
        this.validators.set(name, this.ajv.compile(schema));
      });
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize SchemaValidatorService:', error);
    }
  }

  getValidator(schemaName: string): ValidateFunction | undefined {
    return this.validators.get(schemaName);
  }

  getAjv() {
    return this.ajv;
  }
}

export const schemaValidatorService = new SchemaValidatorService();
