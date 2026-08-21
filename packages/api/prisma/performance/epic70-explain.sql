\set ON_ERROR_STOP on

BEGIN;

INSERT INTO organizations ("id", "name", "code")
VALUES ('70000000-0000-0000-0000-000000000001', 'Epic 70 plan fixture', 'EPIC70_PLAN');

INSERT INTO users ("id", "organization_id", "username", "password")
VALUES (
  '70000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0000-000000000001',
  'epic70-plan-user',
  'not-a-login'
);

INSERT INTO courses ("id", "organization_id", "title", "version", "created_by")
VALUES (
  '70000000-0000-0000-0000-000000000003',
  '70000000-0000-0000-0000-000000000001',
  'Epic 70 plan course',
  '1',
  '70000000-0000-0000-0000-000000000002'
);

INSERT INTO tasks (
  "id", "course_id", "title", "stage", "env_config", "sandbox_config",
  "test_config", "prompt_config"
)
SELECT
  ('70000000-0000-0000-0001-' || lpad(series::text, 12, '0'))::uuid,
  '70000000-0000-0000-0000-000000000003',
  'Task ' || series,
  series % 20,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
FROM generate_series(1, 2000) series;

INSERT INTO workspaces ("id", "user_id", "task_id", "updated_at")
VALUES (
  '70000000-0000-0000-0000-000000000004',
  '70000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0001-000000000001',
  now()
);

INSERT INTO workspace_versions ("id", "workspace_id", "version", "trigger", "snapshot")
SELECT
  ('70000000-0000-0000-0002-' || lpad(series::text, 12, '0'))::uuid,
  '70000000-0000-0000-0000-000000000004',
  series,
  'MANUAL',
  jsonb_build_object('version', series)
FROM generate_series(1, 5000) series;

INSERT INTO submissions ("id", "task_id", "user_id", "status", "created_at")
SELECT
  ('70000000-0000-0000-0003-' || lpad(series::text, 12, '0'))::uuid,
  ('70000000-0000-0000-0001-' || lpad(((series % 2000) + 1)::text, 12, '0'))::uuid,
  '70000000-0000-0000-0000-000000000002',
  CASE WHEN series % 5 = 0 THEN 'PENDING' ELSE 'PASSED' END,
  now() - make_interval(secs => series)
FROM generate_series(1, 5000) series;

INSERT INTO conversations (
  "id", "organization_id", "user_id", "task_id", "updated_at"
)
VALUES (
  '70000000-0000-0000-0000-000000000005',
  '70000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000002',
  '70000000-0000-0000-0001-000000000001',
  now()
);

INSERT INTO conversation_messages ("id", "conversation_id", "role", "content")
SELECT
  ('70000000-0000-0000-0004-' || lpad(series::text, 12, '0'))::uuid,
  '70000000-0000-0000-0000-000000000005',
  'user',
  'Message ' || series
FROM generate_series(1, 5000) series;

INSERT INTO discussions (
  "id", "user_id", "task_id", "context_type", "title", "status",
  "assigned_to_id", "updated_at"
)
SELECT
  ('70000000-0000-0000-0005-' || lpad(series::text, 12, '0'))::uuid,
  '70000000-0000-0000-0000-000000000002',
  ('70000000-0000-0000-0001-' || lpad(((series % 2000) + 1)::text, 12, '0'))::uuid,
  'TASK',
  'Discussion ' || series,
  CASE WHEN series % 3 = 0 THEN 'OPEN' ELSE 'RESOLVED' END,
  CASE
    WHEN series % 100 = 0 THEN NULL
    ELSE '70000000-0000-0000-0000-000000000002'::uuid
  END,
  now() - make_interval(secs => series)
FROM generate_series(1, 5000) series;

ANALYZE tasks;
ANALYZE submissions;
ANALYZE conversation_messages;
ANALYZE workspace_versions;
ANALYZE discussions;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM submissions
WHERE "user_id" = '70000000-0000-0000-0000-000000000002'
ORDER BY "created_at" DESC LIMIT 20;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM tasks
WHERE "course_id" = '70000000-0000-0000-0000-000000000003'
  AND "stage" = 3;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM conversation_messages
WHERE "conversation_id" = '70000000-0000-0000-0000-000000000005'
ORDER BY "created_at" ASC LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM workspace_versions
WHERE "workspace_id" = '70000000-0000-0000-0000-000000000004'
ORDER BY "version" DESC LIMIT 50;

EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM discussions
WHERE "status" = 'OPEN' AND "assigned_to_id" IS NULL
ORDER BY "updated_at" DESC LIMIT 50;

ROLLBACK;
