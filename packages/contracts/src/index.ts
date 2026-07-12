import * as envSchema from '../schemas/env.schema.json';
import * as sandboxSchema from '../schemas/sandbox.schema.json';
import * as testSchema from '../schemas/test.schema.json';
import * as promptSchema from '../schemas/prompt.schema.json';
import * as workflowSchema from '../schemas/workflow.schema.json';

export const schemas = {
  env: envSchema,
  sandbox: sandboxSchema,
  test: testSchema,
  prompt: promptSchema,
  workflow: workflowSchema,
};

export type SchemaName = keyof typeof schemas;

export * from './dto/model-info.dto';
