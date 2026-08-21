import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  // LLM General Config
  LLM_PROVIDER: Joi.string().valid('openai', 'deepseek', 'mock').default('mock'),
  ENABLE_MOCK_PROVIDER: Joi.boolean().default(false),
  RAG_VECTOR_STORE: Joi.string().valid('memory', 'pgvector').default('memory'),
  RAG_ENABLED: Joi.boolean().default(true),
  RAG_TOP_K: Joi.number().integer().min(1).max(100).default(3),
  RAG_CHUNK_SIZE: Joi.number().integer().min(100).max(10000).default(1000),
  RETRIEVAL_ROLLOUT_MODE: Joi.string().valid('LEGACY', 'SHADOW', 'ACTIVE').default('LEGACY'),
  RETRIEVAL_ROLLOUT_ORGANIZATIONS: Joi.string().allow('').default(''),
  RETRIEVAL_ROLLOUT_COURSES: Joi.string().allow('').default(''),
  RETRIEVAL_ROLLOUT_USERS: Joi.string().allow('').default(''),
  RETRIEVAL_DISABLED_QUERY_ROUTER: Joi.string().allow('').default(''),
  RETRIEVAL_DISABLED_CODE_RETRIEVAL: Joi.string().allow('').default(''),
  RETRIEVAL_DISABLED_PROGRESSIVE_DISCLOSURE: Joi.string().allow('').default(''),

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
  DATA_LIFECYCLE_ENABLED: Joi.boolean().default(true),
  DATA_LIFECYCLE_BATCH_SIZE: Joi.number().integer().min(1).max(10_000).default(1_000),
  WORKSPACE_VERSION_MAX_COUNT: Joi.number().integer().min(1).max(1_000).default(50),
  WORKSPACE_VERSION_RETENTION_DAYS: Joi.number().integer().min(1).default(90),
  CONVERSATION_RETENTION_DAYS: Joi.number().integer().min(1).default(365),
  LLM_REQUEST_RETENTION_DAYS: Joi.number().integer().min(1).default(180),
  LLM_AUDIT_RETENTION_DAYS: Joi.number().integer().min(1).default(365),
  AUDIT_EVENT_RETENTION_DAYS: Joi.number().integer().min(365).default(2_555),
  CLIENT_LOG_RETENTION_DAYS: Joi.number().integer().min(1).default(30),
  CLIENT_METRIC_RETENTION_DAYS: Joi.number().integer().min(1).default(90),
  SUBMISSION_ARCHIVE_THRESHOLD_BYTES: Joi.number().integer().min(65_536).default(262_144),

  // Auth
  JWT_SECRET: Joi.string()
    .min(32)
    .invalid('secretKey', 'default-secret', 'super-secret-key', 'change-me-in-production')
    .required(),
  JWT_ALGORITHM: Joi.string().valid('HS256', 'HS384', 'HS512').default('HS256'),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // Sandbox selection and hard security limits.
  SANDBOX_EXECUTOR: Joi.string().valid('docker', 'local').default('docker'),
  SANDBOX_ENABLED_LANGUAGES: Joi.string().default('node'),
  SANDBOX_NODE_IMAGE: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/i)
    .default(
      'node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293',
    ),
  SANDBOX_JAVA_IMAGE: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/i)
    .default(
      'eclipse-temurin:21-jdk@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    ),
  SANDBOX_PYTHON_IMAGE: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/i)
    .default(
      'python:3.12-slim@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    ),
  SANDBOX_GO_IMAGE: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/i)
    .default(
      'golang:1.24-alpine@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
    ),
  SANDBOX_RUST_IMAGE: Joi.string()
    .pattern(/^[a-z0-9][a-z0-9./:_-]*@sha256:[a-f0-9]{64}$/i)
    .default(
      'rust:1.84-slim@sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    ),
  SANDBOX_IMAGE_ALLOWLIST: Joi.string().default(
    'node:20-alpine,eclipse-temurin:21-jdk,python:3.12-slim,golang:1.24-alpine,rust:1.84-slim',
  ),
  SANDBOX_TIMEOUT_MS: Joi.number().integer().min(1000).max(300000).default(30000),
  SANDBOX_MEMORY_LIMIT: Joi.string()
    .pattern(/^\d+[kmg]$/i)
    .default('256m'),
  SANDBOX_CPU_LIMIT: Joi.number().positive().max(4).default(0.5),
  SANDBOX_PIDS_LIMIT: Joi.number().integer().min(16).max(512).default(128),
  SANDBOX_USER_CONCURRENCY: Joi.number().integer().min(1).max(10).default(2),
  SANDBOX_ORG_CONCURRENCY: Joi.number().integer().min(1).max(100).default(10),
  TEMPLATE_GIT_ALLOWED_HOSTS: Joi.string().default('github.com,gitlab.com'),
  TEMPLATE_GIT_MAX_BYTES: Joi.number().integer().min(1024).max(100_000_000).default(10_000_000),
  TEMPLATE_GIT_MAX_FILES: Joi.number().integer().min(1).max(100_000).default(5_000),
});
