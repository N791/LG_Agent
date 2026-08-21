\set ON_ERROR_STOP on

DO $$
DECLARE
  registry_row RECORD;
BEGIN
  SELECT * INTO registry_row
    FROM permission_registry_state
   WHERE id = 'permission-registry';
  IF registry_row.registry_version <> 1
     OR registry_row.registry_digest <> 'ecb6202832cd0ef4c97c4bac811a0676a108455f53668efb05cb4ba41efc148d'
     OR registry_row.release_version <> 'ci-contract' THEN
    RAISE EXCEPTION 'permission registry reconciliation state is not current';
  END IF;

  IF (SELECT count(*) FROM permissions WHERE deprecated_at IS NULL) <> 35 THEN
    RAISE EXCEPTION 'permission registry row count drifted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM permissions
     WHERE registry_version <> 1
        OR scope NOT IN ('PLATFORM', 'ORGANIZATION')
        OR risk NOT IN ('LOW', 'HIGH')
  ) THEN
    RAISE EXCEPTION 'permission registry fields drifted';
  END IF;

  IF (SELECT count(*) FROM authorization_roles
       WHERE organization_id IS NULL AND is_system) <> 4 THEN
    RAISE EXCEPTION 'system role registry drifted';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM (VALUES
        ('ADMIN', 26),
        ('MENTOR', 19),
        ('TRAINEE', 16),
        ('PLATFORM_ADMIN', 9)
      ) expected(role_key, permission_count)
      LEFT JOIN authorization_roles role
        ON role.key = expected.role_key
       AND role.organization_id IS NULL
       AND role.is_system
      LEFT JOIN LATERAL (
        SELECT count(*)::integer AS permission_count
          FROM role_permissions
         WHERE role_id = role.id
      ) actual ON true
     WHERE role.id IS NULL
        OR actual.permission_count <> expected.permission_count
  ) THEN
    RAISE EXCEPTION 'default system role permissions drifted';
  END IF;
END $$;
