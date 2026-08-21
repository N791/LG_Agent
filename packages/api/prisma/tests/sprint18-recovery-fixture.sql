\set ON_ERROR_STOP on

INSERT INTO organizations (id, name, code)
VALUES (
  '18000000-0000-4000-8000-000000000001',
  'Sprint 18 recovery fixture',
  'SPRINT18_RECOVERY'
);

INSERT INTO users (
  id, organization_id, username, password, role, legacy_role_migrated_at
)
VALUES (
  '18000000-0000-4000-8000-000000000002',
  '18000000-0000-4000-8000-000000000001',
  'sprint18-recovery-user',
  'not-a-login',
  'MENTOR',
  now()
);

INSERT INTO authorization_roles (
  id, organization_id, key, name, description, is_system
)
VALUES (
  '18000000-0000-4000-8000-000000000003',
  '18000000-0000-4000-8000-000000000001',
  'sprint18-custom-role',
  'Sprint 18 custom role',
  'Must survive application rollback and snapshot recovery',
  false
);

INSERT INTO user_roles (user_id, role_id, organization_id)
VALUES (
  '18000000-0000-4000-8000-000000000002',
  '18000000-0000-4000-8000-000000000003',
  '18000000-0000-4000-8000-000000000001'
);
