import * as envSchema from '../schemas/env.schema.json';
import * as sandboxSchema from '../schemas/sandbox.schema.json';
import * as testSchema from '../schemas/test.schema.json';
import * as promptSchema from '../schemas/prompt.schema.json';
export const schemas = {
  env: envSchema,
  sandbox: sandboxSchema,
  test: testSchema,
  prompt: promptSchema,
};

export type SchemaName = keyof typeof schemas;

export const SCHEMA_IDS = {
  env: 'lg-agent:schema:env',
  sandbox: 'lg-agent:schema:sandbox',
  test: 'lg-agent:schema:test',
  prompt: 'lg-agent:schema:prompt',
} as const satisfies Record<SchemaName, string>;

export type SchemaId = (typeof SCHEMA_IDS)[SchemaName];

export * from './authorization';
export {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_REGISTRY,
  PERMISSION_REGISTRY_VERSION,
  SYSTEM_ROLE_REGISTRY,
  PERMISSION_SCOPES,
} from './authorization';
export * from './dto/achievement.dto';
export * from './dto/api-governance.dto';
export * from './dto/ai-review.dto';
export * from './dto/conversation.dto';
export * from './dto/dashboard.dto';
export * from './dto/discussion.dto';
export * from './dto/knowledge.dto';
export * from './dto/learning-progress.dto';
export * from './dto/model-info.dto';
export * from './dto/mobile.dto';
export * from './dto/notification.dto';
export * from './dto/organization.dto';
export * from './dto/retrieval.dto';
export * from './dto/sandbox.dto';
export * from './dto/submission.dto';
export * from './dto/starter-template.dto';
export * from './dto/task.dto';
export * from './dto/workspace.dto';
export * from './dto/workspace.repository';

export { TaskType, TaskDifficulty } from './dto/task.dto';
