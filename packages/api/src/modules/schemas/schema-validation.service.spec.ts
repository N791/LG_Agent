import { Test, TestingModule } from '@nestjs/testing';
import { SchemaValidationService } from './schema-validation.service';
import { SchemaRegistryService } from './schema-registry.service';
import { BadRequestException } from '@nestjs/common';

describe('SchemaValidationService', () => {
  let service: SchemaValidationService;
  let registry: SchemaRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaValidationService, SchemaRegistryService],
    }).compile();

    service = module.get<SchemaValidationService>(SchemaValidationService);
    registry = module.get<SchemaRegistryService>(SchemaRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate successfully against a registered schema', () => {
    registry.registerSchema('test-schema', {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    });

    // Should not throw
    expect(() => service.validate('test-schema', { name: 'Alice' })).not.toThrow();
  });

  it('should throw BadRequestException on invalid data', () => {
    registry.registerSchema('test-schema', {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    });

    expect(() => service.validate('test-schema', { age: 20 })).toThrow(BadRequestException);
  });
});
