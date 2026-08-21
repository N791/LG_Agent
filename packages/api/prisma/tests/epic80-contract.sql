DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'user_roles_user_id_organization_id_fkey'
       AND contype = 'f'
  ) THEN
    RAISE EXCEPTION 'missing compound user/organization assignment foreign key';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'user_roles_scope_guard'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'missing role visibility assignment trigger';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'authorization_roles_scope_change_guard'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'missing assigned role scope-change trigger';
  END IF;

  IF position(
    'FOR SHARE' IN upper(pg_get_functiondef('enforce_user_role_scope'::regproc))
  ) = 0 THEN
    RAISE EXCEPTION 'assignment guard must lock the role row for concurrent scope changes';
  END IF;
END;
$$;

-- Direct, bulk, and concurrent writers receive the same invariant enforcement
-- as the API. The fixture rows are transaction-local to this block and removed.
DO $$
DECLARE
  organization_a UUID := gen_random_uuid();
  organization_b UUID := gen_random_uuid();
  user_a UUID := gen_random_uuid();
  user_b UUID := gen_random_uuid();
  custom_role_id UUID;
  global_role_id UUID;
  suffix TEXT := replace(gen_random_uuid()::text, '-', '');
BEGIN
  INSERT INTO "organizations" ("id", "name", "code")
  VALUES
    (organization_a, 'Epic 80 contract A', 'epic80-a-' || suffix),
    (organization_b, 'Epic 80 contract B', 'epic80-b-' || suffix);
  INSERT INTO "users" ("id", "organization_id", "username", "password", "role")
  VALUES
    (user_a, organization_a, 'epic80-a-' || suffix, 'contract-only', 'TRAINEE'),
    (user_b, organization_b, 'epic80-b-' || suffix, 'contract-only', 'TRAINEE');
  INSERT INTO "authorization_roles" ("id", "organization_id", "key", "name")
  VALUES (gen_random_uuid(), organization_a, 'epic80-custom-' || suffix, 'Epic 80 custom')
  RETURNING "id" INTO custom_role_id;
  SELECT r."id"
    INTO global_role_id
    FROM "authorization_roles" r
   WHERE r."organization_id" IS NULL
   LIMIT 1;

  BEGIN
    INSERT INTO "user_roles" ("user_id", "role_id", "organization_id")
    VALUES (user_a, global_role_id, organization_b);
    RAISE EXCEPTION 'cross-tenant direct assignment unexpectedly succeeded';
  EXCEPTION
    WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO "user_roles" ("user_id", "role_id", "organization_id")
    SELECT candidate."user_id", candidate."role_id", candidate."organization_id"
      FROM (
        VALUES
          (user_a, global_role_id, organization_a),
          (user_b, custom_role_id, organization_b)
      ) AS candidate("user_id", "role_id", "organization_id");
    RAISE EXCEPTION 'cross-organization custom role unexpectedly succeeded';
  EXCEPTION
    WHEN check_violation THEN NULL;
  END;

  IF EXISTS (
    SELECT 1 FROM "user_roles"
     WHERE ("user_id" = user_a AND "role_id" = global_role_id)
        OR ("user_id" = user_b AND "role_id" = custom_role_id)
  ) THEN
    RAISE EXCEPTION 'failed bulk assignment was not atomic';
  END IF;

  DELETE FROM "users" WHERE "id" IN (user_a, user_b);
  DELETE FROM "authorization_roles" WHERE "id" = custom_role_id;
  DELETE FROM "organizations" WHERE "id" IN (organization_a, organization_b);
END;
$$;
