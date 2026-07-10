import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // LLM General Config
  LLM_PROVIDER: Joi.string().valid('openai', 'deepseek', 'mock').default('mock'),
  ENABLE_MOCK_PROVIDER: Joi.boolean().default(false),

  // OpenAI Config
  OPENAI_API_KEY: Joi.string().allow('').optional(),
  OPENAI_BASE_URL: Joi.string().uri().optional(),
  OPENAI_TIMEOUT_MS: Joi.number().default(30000),
  OPENAI_MAX_RETRIES: Joi.number().default(3),
  OPENAI_DEFAULT_MODEL: Joi.string().default('gpt-4o'),

  // DeepSeek Config
  DEEPSEEK_API_KEY: Joi.string().allow('').optional(),
  DEEPSEEK_BASE_URL: Joi.string().uri().default('https://api.deepseek.com/v1'),
  DEEPSEEK_TIMEOUT_MS: Joi.number().default(30000),
  DEEPSEEK_MAX_RETRIES: Joi.number().default(3),
  DEEPSEEK_DEFAULT_MODEL: Joi.string().default('deepseek-chat'),

  // Database
  DATABASE_URL: Joi.string().required(),

  // Auth
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('24h'),
});
