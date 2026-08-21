DO $migration$
BEGIN
IF to_regclass('public.execution_events') IS NULL THEN

ALTER TABLE "submissions"
  ADD COLUMN "idempotency_key" VARCHAR,
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "started_at" TIMESTAMP(3),
  ADD COLUMN "finished_at" TIMESTAMP(3),
  ADD COLUMN "failure_reason" TEXT,
  ADD COLUMN "execution_owner" VARCHAR,
  ADD COLUMN "heartbeat_at" TIMESTAMP(3),
  ADD COLUMN "lease_expires_at" TIMESTAMP(3),
  ADD COLUMN "retry_count" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "max_retries" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "next_attempt_at" TIMESTAMP(3),
  ADD COLUMN "dead_lettered_at" TIMESTAMP(3),
  ADD COLUMN "cancel_requested_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "submissions_idempotency_key_key" ON "submissions"("idempotency_key");
CREATE UNIQUE INDEX "submissions_one_active_attempt_per_user_task"
  ON "submissions"("user_id", "task_id")
  WHERE "status" IN ('PENDING', 'RUNNING');
CREATE INDEX "submissions_status_next_attempt_at_idx" ON "submissions"("status", "next_attempt_at");
CREATE INDEX "submissions_execution_owner_lease_expires_at_idx"
  ON "submissions"("execution_owner", "lease_expires_at");

CREATE TABLE "execution_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "submission_id" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "type" VARCHAR NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "execution_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "execution_events_submission_id_fkey"
    FOREIGN KEY ("submission_id") REFERENCES "submissions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "execution_events_submission_id_sequence_key"
  ON "execution_events"("submission_id", "sequence");
CREATE INDEX "execution_events_submission_id_created_at_idx"
  ON "execution_events"("submission_id", "created_at");

END IF;
END;
$migration$;
