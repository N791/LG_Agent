-- Epic 70 uses additive indexes and NOT VALID -> VALID checks so an existing
-- production table is not held under a long validation lock.

ALTER TABLE "submissions"
  ADD CONSTRAINT "submissions_status_check"
    CHECK ("status" IN ('PENDING', 'RUNNING', 'PASSED', 'FAILED', 'ERROR', 'CANCELLED'))
    NOT VALID,
  ADD CONSTRAINT "submissions_score_check"
    CHECK ("score" BETWEEN 0 AND 100)
    NOT VALID,
  ADD CONSTRAINT "submissions_attempt_check"
    CHECK ("attempt" >= 0 AND "retry_count" >= 0 AND "max_retries" >= 0)
    NOT VALID,
  ADD CONSTRAINT "submissions_lease_check"
    CHECK (
      ("execution_owner" IS NULL AND "heartbeat_at" IS NULL AND "lease_expires_at" IS NULL)
      OR
      ("execution_owner" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
    )
    NOT VALID;

ALTER TABLE "submissions" VALIDATE CONSTRAINT "submissions_status_check";
ALTER TABLE "submissions" VALIDATE CONSTRAINT "submissions_score_check";
ALTER TABLE "submissions" VALIDATE CONSTRAINT "submissions_attempt_check";
ALTER TABLE "submissions" VALIDATE CONSTRAINT "submissions_lease_check";

ALTER TABLE "execution_events"
  ADD CONSTRAINT "execution_events_sequence_check"
    CHECK ("sequence" > 0)
    NOT VALID;
ALTER TABLE "execution_events" VALIDATE CONSTRAINT "execution_events_sequence_check";

-- Repair version numbers deterministically before enforcing the invariant.
WITH ranked AS (
  SELECT
    "id",
    row_number() OVER (
      PARTITION BY "workspace_id"
      ORDER BY "version", "created_at", "id"
    )::integer AS repaired_version
  FROM "workspace_versions"
)
UPDATE "workspace_versions" AS target
SET "version" = ranked.repaired_version
FROM ranked
WHERE target."id" = ranked."id"
  AND target."version" <> ranked.repaired_version;

CREATE INDEX "tasks_course_id_stage_idx"
  ON "tasks"("course_id", "stage");
CREATE INDEX "submissions_user_id_created_at_idx"
  ON "submissions"("user_id", "created_at");
CREATE INDEX "submissions_task_id_created_at_idx"
  ON "submissions"("task_id", "created_at");
CREATE INDEX "conversation_messages_conversation_id_created_at_idx"
  ON "conversation_messages"("conversation_id", "created_at");
CREATE UNIQUE INDEX "workspace_versions_workspace_id_version_key"
  ON "workspace_versions"("workspace_id", "version");
CREATE INDEX "workspace_versions_created_at_idx"
  ON "workspace_versions"("created_at");
CREATE INDEX "discussions_task_id_updated_at_idx"
  ON "discussions"("task_id", "updated_at");
CREATE INDEX "discussions_status_assigned_to_id_updated_at_idx"
  ON "discussions"("status", "assigned_to_id", "updated_at");

-- Enforce the organization path for tenant-owned models even when a caller
-- bypasses the application repository. ExecutionEvent inherits this scope
-- through its non-null Submission foreign key.
CREATE OR REPLACE FUNCTION enforce_tenant_ownership()
RETURNS trigger
LANGUAGE plpgsql
AS $tenant$
DECLARE
  user_organization UUID;
  task_organization UUID;
  linked_organization UUID;
BEGIN
  SELECT "organization_id" INTO user_organization
  FROM "users"
  WHERE "id" = NEW."user_id";

  SELECT course."organization_id" INTO task_organization
  FROM "tasks" task
  JOIN "courses" course ON course."id" = task."course_id"
  WHERE task."id" = NEW."task_id";

  IF user_organization IS DISTINCT FROM task_organization THEN
    RAISE EXCEPTION 'tenant ownership mismatch for %', TG_TABLE_NAME
      USING ERRCODE = '23514';
  END IF;

  IF TG_TABLE_NAME = 'conversations' THEN
    IF NEW."organization_id" IS DISTINCT FROM user_organization THEN
      RAISE EXCEPTION 'conversation organization mismatch'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'discussions' THEN
    IF NEW."submission_id" IS NOT NULL THEN
      SELECT account."organization_id" INTO linked_organization
      FROM "submissions" submission
      JOIN "users" account ON account."id" = submission."user_id"
      WHERE submission."id" = NEW."submission_id";
      IF linked_organization IS DISTINCT FROM user_organization THEN
        RAISE EXCEPTION 'discussion submission organization mismatch'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF NEW."workspace_id" IS NOT NULL THEN
      SELECT account."organization_id" INTO linked_organization
      FROM "workspaces" workspace
      JOIN "users" account ON account."id" = workspace."user_id"
      WHERE workspace."id" = NEW."workspace_id";
      IF linked_organization IS DISTINCT FROM user_organization THEN
        RAISE EXCEPTION 'discussion workspace organization mismatch'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    IF NEW."assigned_to_id" IS NOT NULL THEN
      SELECT "organization_id" INTO linked_organization
      FROM "users"
      WHERE "id" = NEW."assigned_to_id";
      IF linked_organization IS DISTINCT FROM user_organization THEN
        RAISE EXCEPTION 'discussion assignee organization mismatch'
          USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$tenant$;

CREATE TRIGGER "submissions_tenant_ownership"
BEFORE INSERT OR UPDATE OF "user_id", "task_id" ON "submissions"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_ownership();

CREATE TRIGGER "workspaces_tenant_ownership"
BEFORE INSERT OR UPDATE OF "user_id", "task_id" ON "workspaces"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_ownership();

CREATE TRIGGER "conversations_tenant_ownership"
BEFORE INSERT OR UPDATE OF "organization_id", "user_id", "task_id" ON "conversations"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_ownership();

CREATE TRIGGER "discussions_tenant_ownership"
BEFORE INSERT OR UPDATE OF
  "user_id", "task_id", "submission_id", "workspace_id", "assigned_to_id"
ON "discussions"
FOR EACH ROW EXECUTE FUNCTION enforce_tenant_ownership();
