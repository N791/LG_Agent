CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "llm_request_logs"
  ADD COLUMN IF NOT EXISTS "organization_id" UUID,
  ADD COLUMN IF NOT EXISTS "trace_id" VARCHAR,
  ADD COLUMN IF NOT EXISTS "rule_hits" JSONB,
  ADD COLUMN IF NOT EXISTS "fallback_from" VARCHAR;

CREATE INDEX IF NOT EXISTS "llm_request_logs_organization_id_created_at_idx"
  ON "llm_request_logs" ("organization_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "llm_request_logs_trace_id_idx"
  ON "llm_request_logs" ("trace_id");

CREATE TABLE IF NOT EXISTS "knowledge_vectors" (
  "id" VARCHAR PRIMARY KEY,
  "source" VARCHAR NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "embedding" vector NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "knowledge_vectors_source_idx" ON "knowledge_vectors" ("source");
