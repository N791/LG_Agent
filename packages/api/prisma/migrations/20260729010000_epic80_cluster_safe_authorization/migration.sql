-- Epic 80: enforce assignment tenant invariants at the database boundary.
-- Invalid legacy rows are deliberately removed before constraints are installed:
-- cross-tenant grants are unsafe and cannot be migrated to another tenant.
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "legacy_role_migrated_at" TIMESTAMPTZ;

UPDATE "users" u
   SET "legacy_role_migrated_at" = CURRENT_TIMESTAMP
 WHERE "legacy_role_migrated_at" IS NULL
   AND EXISTS (
     SELECT 1
       FROM "user_roles" ur
       JOIN "authorization_roles" r
         ON r."id" = ur."role_id"
        AND r."is_system" = true
        AND r."organization_id" IS NULL
      WHERE ur."user_id" = u."id"
        AND ur."organization_id" = u."organization_id"
        AND r."key" = u."role"::text
   );

DELETE FROM "user_roles" ur
USING "users" u
WHERE ur."user_id" = u."id"
  AND ur."organization_id" <> u."organization_id";

DELETE FROM "user_roles" ur
USING "authorization_roles" r
WHERE ur."role_id" = r."id"
  AND r."organization_id" IS NOT NULL
  AND ur."organization_id" <> r."organization_id";

CREATE UNIQUE INDEX IF NOT EXISTS "users_id_organization_id_key"
  ON "users" ("id", "organization_id");

ALTER TABLE "user_roles"
  DROP CONSTRAINT IF EXISTS "user_roles_user_id_fkey";

ALTER TABLE "user_roles"
  ADD CONSTRAINT "user_roles_user_id_organization_id_fkey"
  FOREIGN KEY ("user_id", "organization_id")
  REFERENCES "users" ("id", "organization_id")
  ON DELETE CASCADE
  ON UPDATE RESTRICT;

CREATE OR REPLACE FUNCTION "enforce_user_role_scope"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  role_organization_id UUID;
BEGIN
  SELECT "organization_id"
    INTO role_organization_id
    FROM "authorization_roles"
   WHERE "id" = NEW."role_id"
   FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'authorization role % does not exist', NEW."role_id"
      USING ERRCODE = '23503';
  END IF;

  IF role_organization_id IS NOT NULL
     AND role_organization_id <> NEW."organization_id" THEN
    RAISE EXCEPTION 'role organization does not match assignment organization'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "user_roles_scope_guard" ON "user_roles";
CREATE TRIGGER "user_roles_scope_guard"
BEFORE INSERT OR UPDATE OF "role_id", "organization_id"
ON "user_roles"
FOR EACH ROW
EXECUTE FUNCTION "enforce_user_role_scope"();

CREATE OR REPLACE FUNCTION "prevent_assigned_role_scope_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."organization_id" IS DISTINCT FROM OLD."organization_id"
     AND EXISTS (
       SELECT 1
         FROM "user_roles" ur
        WHERE ur."role_id" = NEW."id"
          AND NEW."organization_id" IS NOT NULL
          AND ur."organization_id" <> NEW."organization_id"
     ) THEN
    RAISE EXCEPTION 'assigned role organization cannot be changed across tenants'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "authorization_roles_scope_change_guard" ON "authorization_roles";
CREATE TRIGGER "authorization_roles_scope_change_guard"
BEFORE UPDATE OF "organization_id"
ON "authorization_roles"
FOR EACH ROW
EXECUTE FUNCTION "prevent_assigned_role_scope_change"();
