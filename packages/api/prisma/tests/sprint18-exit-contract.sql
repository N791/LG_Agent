\set ON_ERROR_STOP on

DO $$
BEGIN
  IF to_regclass('public.permissions') IS NULL
     OR to_regclass('public.authorization_roles') IS NULL
     OR to_regclass('public.role_permissions') IS NULL
     OR to_regclass('public.user_roles') IS NULL THEN
    RAISE EXCEPTION 'one or more Epic C authorization tables are missing';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM user_roles ur
      JOIN users u ON u.id = ur.user_id
     WHERE u.organization_id <> ur.organization_id
  ) THEN
    RAISE EXCEPTION 'cross-organization user_roles assignments exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM users u
      JOIN user_roles ur
        ON ur.user_id = u.id
       AND ur.organization_id = u.organization_id
      JOIN authorization_roles r
        ON r.id = ur.role_id
       AND r.organization_id = u.organization_id
     WHERE u.id = '18000000-0000-4000-8000-000000000002'
       AND u.role = 'MENTOR'
       AND r.id = '18000000-0000-4000-8000-000000000003'
       AND r.key = 'sprint18-custom-role'
       AND NOT r.is_system
  ) THEN
    RAISE EXCEPTION 'legacy role or custom authorization assignment was not preserved';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM permission_registry_state
     WHERE id = 'permission-registry'
       AND registry_version = 1
       AND registry_digest = 'ecb6202832cd0ef4c97c4bac811a0676a108455f53668efb05cb4ba41efc148d'
  ) THEN
    RAISE EXCEPTION 'permission registry state is absent or incompatible';
  END IF;
END;
$$;
