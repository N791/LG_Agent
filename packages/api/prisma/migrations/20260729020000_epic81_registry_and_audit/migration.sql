-- Epic 81: registry reconciliation state and the shared audit contract.
-- permission-registry-version: 1
-- permission-registry-digest: ecb6202832cd0ef4c97c4bac811a0676a108455f53668efb05cb4ba41efc148d
CREATE TABLE IF NOT EXISTS "permission_registry_state" (
  "id" VARCHAR NOT NULL DEFAULT 'permission-registry',
  "registry_version" INTEGER NOT NULL,
  "registry_digest" VARCHAR NOT NULL,
  "release_version" VARCHAR NOT NULL,
  "reconciled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permission_registry_state_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "permission_registry_state_singleton_check"
    CHECK ("id" = 'permission-registry')
);

ALTER TABLE "audit_events"
  ADD COLUMN IF NOT EXISTS "organization_id" UUID,
  ADD COLUMN IF NOT EXISTS "request_id" VARCHAR,
  ADD COLUMN IF NOT EXISTS "before" JSONB,
  ADD COLUMN IF NOT EXISTS "after" JSONB;

ALTER TABLE "audit_events"
  ALTER COLUMN "trace_id" TYPE VARCHAR USING "trace_id"::text;

CREATE INDEX IF NOT EXISTS "audit_events_organization_id_created_at_idx"
  ON "audit_events" ("organization_id", "created_at");
