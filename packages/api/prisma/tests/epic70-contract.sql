\set ON_ERROR_STOP on

BEGIN;

INSERT INTO organizations ("id", "name", "code")
VALUES
  ('71000000-0000-0000-0000-000000000001', 'Tenant A', 'EPIC70_A'),
  ('71000000-0000-0000-0000-000000000002', 'Tenant B', 'EPIC70_B');

INSERT INTO users ("id", "organization_id", "username", "password")
VALUES
  (
    '71000000-0000-0000-0000-000000000003',
    '71000000-0000-0000-0000-000000000001',
    'epic70-a',
    'not-a-login'
  ),
  (
    '71000000-0000-0000-0000-000000000004',
    '71000000-0000-0000-0000-000000000002',
    'epic70-b',
    'not-a-login'
  );

INSERT INTO courses ("id", "organization_id", "title", "version", "created_by")
VALUES (
  '71000000-0000-0000-0000-000000000005',
  '71000000-0000-0000-0000-000000000001',
  'Tenant A course',
  '1',
  '71000000-0000-0000-0000-000000000003'
);

INSERT INTO tasks (
  "id", "course_id", "title", "stage", "env_config", "sandbox_config",
  "test_config", "prompt_config"
)
VALUES (
  '71000000-0000-0000-0000-000000000006',
  '71000000-0000-0000-0000-000000000005',
  'Tenant A task',
  1,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb,
  '{}'::jsonb
);

DO $contract$
BEGIN
  BEGIN
    INSERT INTO submissions ("id", "task_id", "user_id", "status")
    VALUES (
      '71000000-0000-0000-0000-000000000007',
      '71000000-0000-0000-0000-000000000006',
      '71000000-0000-0000-0000-000000000003',
      'NOT_A_STATUS'
    );
    RAISE EXCEPTION 'submission status constraint did not reject invalid state';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO submissions ("id", "task_id", "user_id", "status")
    VALUES (
      '71000000-0000-0000-0000-000000000008',
      '71000000-0000-0000-0000-000000000006',
      '71000000-0000-0000-0000-000000000004',
      'PENDING'
    );
    RAISE EXCEPTION 'tenant trigger did not reject cross-organization ownership';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO submissions (
      "id", "task_id", "user_id", "status", "execution_owner"
    )
    VALUES (
      '71000000-0000-0000-0000-000000000009',
      '71000000-0000-0000-0000-000000000006',
      '71000000-0000-0000-0000-000000000003',
      'RUNNING',
      'worker-without-expiry'
    );
    RAISE EXCEPTION 'lease constraint accepted an owner without expiry';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;
END;
$contract$;

ROLLBACK;
