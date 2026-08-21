-- Epic C: permission-based RBAC. This migration is additive and idempotent at
-- the data layer so registry synchronization can safely be re-run.
CREATE TABLE IF NOT EXISTS "permissions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR NOT NULL,
  "scope" VARCHAR NOT NULL,
  "registry_version" INTEGER NOT NULL,
  "description" TEXT NOT NULL,
  "risk" VARCHAR NOT NULL DEFAULT 'LOW',
  "deprecated_at" TIMESTAMPTZ,
  "replacement_key" VARCHAR,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "permissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "permissions_key_key" UNIQUE ("key"),
  CONSTRAINT "permissions_scope_check" CHECK ("scope" IN ('PLATFORM', 'ORGANIZATION')),
  CONSTRAINT "permissions_risk_check" CHECK ("risk" IN ('LOW', 'HIGH'))
);

CREATE TABLE IF NOT EXISTS "authorization_roles" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "key" VARCHAR NOT NULL,
  "name" VARCHAR NOT NULL,
  "description" TEXT,
  "is_system" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "authorization_roles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "authorization_roles_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "role_id" UUID NOT NULL,
  "permission_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id"),
  CONSTRAINT "role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "authorization_roles"("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS "user_roles" (
  "user_id" UUID NOT NULL,
  "role_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "assigned_by_id" UUID,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id", "organization_id"),
  CONSTRAINT "user_roles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_roles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "authorization_roles"("id") ON DELETE CASCADE,
  CONSTRAINT "user_roles_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "authorization_roles_organization_id_key_key"
  ON "authorization_roles" ("organization_id", "key");
CREATE UNIQUE INDEX IF NOT EXISTS "authorization_roles_system_key_key"
  ON "authorization_roles" ("key") WHERE "organization_id" IS NULL;
CREATE INDEX IF NOT EXISTS "authorization_roles_organization_id_name_idx"
  ON "authorization_roles" ("organization_id", "name");
CREATE INDEX IF NOT EXISTS "permissions_scope_key_idx" ON "permissions" ("scope", "key");
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx"
  ON "role_permissions" ("permission_id");
CREATE INDEX IF NOT EXISTS "user_roles_role_id_organization_id_idx"
  ON "user_roles" ("role_id", "organization_id");
CREATE INDEX IF NOT EXISTS "user_roles_organization_id_user_id_idx"
  ON "user_roles" ("organization_id", "user_id");

INSERT INTO "permissions" ("key", "scope", "registry_version", "description", "risk")
VALUES
  ('profile:read', 'ORGANIZATION', 1, 'Read the current user profile.', 'LOW'),
  ('profile:update', 'ORGANIZATION', 1, 'Update the current user profile.', 'HIGH'),
  ('notification:read', 'ORGANIZATION', 1, 'Read personal notifications.', 'LOW'),
  ('notification:update', 'ORGANIZATION', 1, 'Update personal notifications.', 'LOW'),
  ('achievement:read', 'ORGANIZATION', 1, 'Read personal achievements.', 'LOW'),
  ('organization:read', 'ORGANIZATION', 1, 'Read the current organization.', 'LOW'),
  ('organization:manage', 'ORGANIZATION', 1, 'Update the current organization.', 'HIGH'),
  ('platform-organization:manage', 'PLATFORM', 1, 'Create, list and remove organizations across the platform.', 'HIGH'),
  ('user:read', 'ORGANIZATION', 1, 'Read organization members.', 'LOW'),
  ('user:manage', 'ORGANIZATION', 1, 'Create and update organization members.', 'HIGH'),
  ('role:read', 'ORGANIZATION', 1, 'Read roles and assignments.', 'LOW'),
  ('role:manage', 'ORGANIZATION', 1, 'Manage roles, permissions and assignments.', 'HIGH'),
  ('course:read', 'ORGANIZATION', 1, 'Read organization courses.', 'LOW'),
  ('course:manage', 'ORGANIZATION', 1, 'Create and update organization courses.', 'HIGH'),
  ('task:read', 'ORGANIZATION', 1, 'Read organization tasks.', 'LOW'),
  ('task:manage', 'ORGANIZATION', 1, 'Create and update organization tasks.', 'HIGH'),
  ('training:read', 'ORGANIZATION', 1, 'Read personal training progress.', 'LOW'),
  ('workspace:use', 'ORGANIZATION', 1, 'Use an assigned authoring workspace.', 'LOW'),
  ('submission:read', 'ORGANIZATION', 1, 'Read permitted submissions.', 'LOW'),
  ('submission:create', 'ORGANIZATION', 1, 'Create and cancel personal submissions.', 'LOW'),
  ('submission:manage', 'ORGANIZATION', 1, 'Manage organization submissions.', 'HIGH'),
  ('discussion:read', 'ORGANIZATION', 1, 'Read permitted discussions.', 'LOW'),
  ('discussion:create', 'ORGANIZATION', 1, 'Create and reply to discussions.', 'LOW'),
  ('discussion:manage', 'ORGANIZATION', 1, 'Assign and moderate discussions.', 'HIGH'),
  ('analytics:read', 'ORGANIZATION', 1, 'Read organization analytics.', 'LOW'),
  ('observability:read', 'ORGANIZATION', 1, 'Read organization audit and telemetry data.', 'LOW'),
  ('ai-tutor:use', 'ORGANIZATION', 1, 'Use AI tutoring features.', 'LOW'),
  ('ai-task:generate', 'ORGANIZATION', 1, 'Generate tasks with AI.', 'HIGH'),
  ('ai-retrieval:read', 'ORGANIZATION', 1, 'Inspect retrieval state and evidence.', 'LOW'),
  ('ai-retrieval:manage', 'ORGANIZATION', 1, 'Activate and retry retrieval indexes.', 'HIGH'),
  ('knowledge:read', 'ORGANIZATION', 1, 'Read published knowledge.', 'LOW'),
  ('knowledge:manage', 'ORGANIZATION', 1, 'Rebuild and manage knowledge indexes.', 'HIGH'),
  ('sandbox:execute', 'ORGANIZATION', 1, 'Execute code in the sandbox.', 'LOW'),
  ('system-config:read', 'PLATFORM', 1, 'Read masked platform configuration.', 'HIGH'),
  ('system-config:manage', 'PLATFORM', 1, 'Update platform configuration.', 'HIGH')
ON CONFLICT ("key") DO UPDATE SET
  "scope" = EXCLUDED."scope",
  "registry_version" = EXCLUDED."registry_version",
  "description" = EXCLUDED."description",
  "risk" = EXCLUDED."risk",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "authorization_roles" ("key", "name", "description", "is_system")
VALUES
  ('ADMIN', 'Organization administrator', 'Built-in organization administrator role.', true),
  ('MENTOR', 'Mentor', 'Built-in mentor role.', true),
  ('TRAINEE', 'Trainee', 'Built-in trainee role.', true),
  ('PLATFORM_ADMIN', 'Platform administrator', 'Operator-provisioned platform role.', true)
ON CONFLICT ("key") WHERE "organization_id" IS NULL DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "is_system" = true,
  "updated_at" = CURRENT_TIMESTAMP;

WITH role_map("role_key", "permission_key") AS (
  VALUES
    ('ADMIN', 'profile:read'), ('ADMIN', 'profile:update'),
    ('ADMIN', 'notification:read'), ('ADMIN', 'notification:update'),
    ('ADMIN', 'organization:read'), ('ADMIN', 'organization:manage'),
    ('ADMIN', 'user:read'), ('ADMIN', 'user:manage'),
    ('ADMIN', 'role:read'), ('ADMIN', 'role:manage'),
    ('ADMIN', 'course:read'), ('ADMIN', 'course:manage'),
    ('ADMIN', 'task:read'), ('ADMIN', 'task:manage'),
    ('ADMIN', 'submission:read'), ('ADMIN', 'submission:manage'),
    ('ADMIN', 'discussion:read'), ('ADMIN', 'discussion:manage'),
    ('ADMIN', 'analytics:read'), ('ADMIN', 'observability:read'),
    ('ADMIN', 'ai-tutor:use'), ('ADMIN', 'ai-task:generate'),
    ('ADMIN', 'ai-retrieval:read'), ('ADMIN', 'ai-retrieval:manage'),
    ('ADMIN', 'knowledge:read'), ('ADMIN', 'knowledge:manage'),
    ('MENTOR', 'profile:read'), ('MENTOR', 'profile:update'),
    ('MENTOR', 'notification:read'), ('MENTOR', 'notification:update'),
    ('MENTOR', 'organization:read'), ('MENTOR', 'user:read'),
    ('MENTOR', 'course:read'), ('MENTOR', 'course:manage'),
    ('MENTOR', 'task:read'), ('MENTOR', 'task:manage'),
    ('MENTOR', 'submission:read'), ('MENTOR', 'submission:manage'),
    ('MENTOR', 'discussion:read'), ('MENTOR', 'discussion:manage'),
    ('MENTOR', 'analytics:read'), ('MENTOR', 'ai-tutor:use'),
    ('MENTOR', 'ai-task:generate'), ('MENTOR', 'ai-retrieval:read'),
    ('MENTOR', 'knowledge:read'),
    ('TRAINEE', 'profile:read'), ('TRAINEE', 'profile:update'),
    ('TRAINEE', 'notification:read'), ('TRAINEE', 'notification:update'),
    ('TRAINEE', 'achievement:read'), ('TRAINEE', 'course:read'),
    ('TRAINEE', 'task:read'), ('TRAINEE', 'training:read'),
    ('TRAINEE', 'workspace:use'), ('TRAINEE', 'submission:read'),
    ('TRAINEE', 'submission:create'), ('TRAINEE', 'discussion:read'),
    ('TRAINEE', 'discussion:create'), ('TRAINEE', 'ai-tutor:use'),
    ('TRAINEE', 'knowledge:read'), ('TRAINEE', 'sandbox:execute'),
    ('PLATFORM_ADMIN', 'profile:read'), ('PLATFORM_ADMIN', 'profile:update'),
    ('PLATFORM_ADMIN', 'notification:read'), ('PLATFORM_ADMIN', 'notification:update'),
    ('PLATFORM_ADMIN', 'organization:read'),
    ('PLATFORM_ADMIN', 'platform-organization:manage'),
    ('PLATFORM_ADMIN', 'system-config:read'), ('PLATFORM_ADMIN', 'system-config:manage'),
    ('PLATFORM_ADMIN', 'observability:read')
)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM role_map m
JOIN "authorization_roles" r ON r."key" = m."role_key" AND r."organization_id" IS NULL
JOIN "permissions" p ON p."key" = m."permission_key"
ON CONFLICT DO NOTHING;

INSERT INTO "user_roles" ("user_id", "role_id", "organization_id")
SELECT u."id", r."id", u."organization_id"
FROM "users" u
JOIN "authorization_roles" r ON r."key" = u."role"::text AND r."organization_id" IS NULL
ON CONFLICT DO NOTHING;
