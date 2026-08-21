import { Test, TestingModule } from '@nestjs/testing';
import { SchemaRegistryService } from './schema-registry.service';
import { NotFoundException } from '@nestjs/common';
import { schemas, SCHEMA_IDS } from '@lg-agent/contracts';
import { FileSchemaRepository } from './repositories/file-schema.repository';

describe('SchemaRegistryService', () => {
  let service: SchemaRegistryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SchemaRegistryService],
    }).compile();

    service = module.get<SchemaRegistryService>(SchemaRegistryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should register and retrieve a schema', () => {
    const mockSchema = { type: 'object', properties: { test: { type: 'string' } } };
    service.registerSchema('test-schema', mockSchema);
    expect(service.getSchema('test-schema')).toEqual(mockSchema);
  });

  it('should throw NotFoundException for unknown schema', () => {
    expect(() => service.getSchema('unknown-schema')).toThrow(NotFoundException);
  });

  it('should return all registered schemas', () => {
    const mockSchema = { type: 'object' };
    service.registerSchema('schema1', mockSchema);
    service.registerSchema('schema2', mockSchema);

    const all = service.getAllSchemas();
    expect(Object.keys(all)).toHaveLength(2);
    expect(all['schema1']).toBeDefined();
  });

  it('serves every canonical schema id and compatibility alias', () => {
    new FileSchemaRepository(service).onModuleInit();

    for (const [name, schema] of Object.entries(schemas)) {
      expect(service.getSchema(name)).toBe(schema);
      expect(service.getSchema(SCHEMA_IDS[name as keyof typeof SCHEMA_IDS])).toBe(schema);
    }
  });

  it('returns the stable schema not-found contract for an unknown id', () => {
    expect(() => service.getSchema('lg-agent:schema:unknown')).toThrow('errors.schema.notFound');
  });
});
