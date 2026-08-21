-- Epic 76: repository identity, immutable source files, AST symbols and bounded relation graph.
ALTER TYPE "CodeRelationType" ADD VALUE IF NOT EXISTS 'DEFINES' BEFORE 'CALLS';

CREATE TABLE "code_repositories" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "external_key" VARCHAR NOT NULL,
  "name" VARCHAR NOT NULL,
  "canonical_uri" TEXT NOT NULL,
  "acl" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "code_repositories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "code_repositories_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "code_repositories_org_external_key_key"
  ON "code_repositories"("organization_id", "external_key");
CREATE INDEX "code_repositories_org_name_idx"
  ON "code_repositories"("organization_id", "name");

ALTER TABLE "repository_snapshots" ADD COLUMN "code_repository_id" UUID;

-- Preserve compatibility with repository snapshots created by Epic 74.
INSERT INTO "code_repositories" (
  "id", "organization_id", "external_key", "name", "canonical_uri", "acl", "updated_at"
)
SELECT gen_random_uuid(), rs."organization_id", rs."repository_id", rs."repository_id",
       'repository://' || rs."repository_id", rs."acl", CURRENT_TIMESTAMP
FROM "repository_snapshots" rs
ON CONFLICT ("organization_id", "external_key") DO NOTHING;

UPDATE "repository_snapshots" rs
SET "code_repository_id" = r."id"
FROM "code_repositories" r
WHERE r."organization_id" = rs."organization_id"
  AND r."external_key" = rs."repository_id";

ALTER TABLE "repository_snapshots" ALTER COLUMN "code_repository_id" SET NOT NULL;
ALTER TABLE "repository_snapshots"
  ADD CONSTRAINT "repository_snapshots_code_repository_id_fkey"
  FOREIGN KEY ("code_repository_id") REFERENCES "code_repositories"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "repository_snapshots_code_repository_id_idx"
  ON "repository_snapshots"("code_repository_id", "created_at" DESC);

CREATE TABLE "code_files" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "repository_snapshot_id" UUID NOT NULL,
  "path" TEXT NOT NULL,
  "language" VARCHAR NOT NULL,
  "content" TEXT NOT NULL,
  "content_hash" VARCHAR NOT NULL,
  "parser_version" VARCHAR NOT NULL,
  "parse_confidence" DOUBLE PRECISION NOT NULL,
  "fallback_reason" VARCHAR,
  "generated" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "code_files_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "code_files_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "code_files_repository_snapshot_id_fkey" FOREIGN KEY ("repository_snapshot_id")
    REFERENCES "repository_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "code_files_parse_confidence_check"
    CHECK ("parse_confidence" >= 0.0 AND "parse_confidence" <= 1.0)
);

CREATE UNIQUE INDEX "code_files_snapshot_path_key"
  ON "code_files"("repository_snapshot_id", "path");
CREATE INDEX "code_files_org_hash_parser_idx"
  ON "code_files"("organization_id", "content_hash", "parser_version");
CREATE INDEX "code_relations_org_snapshot_source_type_idx"
  ON "code_relations"("organization_id", "repository_snapshot_id", "source_symbol_id", "relation_type");
CREATE INDEX "code_relations_org_snapshot_target_type_idx"
  ON "code_relations"("organization_id", "repository_snapshot_id", "target_symbol_id", "relation_type");

CREATE TRIGGER "code_files_ready_boundary"
BEFORE INSERT OR UPDATE OR DELETE ON "code_files"
FOR EACH ROW EXECUTE FUNCTION prevent_ready_repository_content_mutation();
