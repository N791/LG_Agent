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

export * from './dto/achievement.dto';
export * from './dto/ai-review.dto';
export * from './dto/conversation.dto';
export * from './dto/dashboard.dto';
export * from './dto/discussion.dto';
export * from './dto/knowledge.dto';
export * from './dto/learning-progress.dto';
export * from './dto/model-info.dto';
export * from './dto/notification.dto';
export * from './dto/sandbox.dto';
export * from './dto/task.dto';
export * from './dto/workspace.dto';
export * from './dto/workspace.repository';

export { TaskType, TaskDifficulty } from './dto/task.dto';
