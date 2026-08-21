-- Epic 74: immutable document versions/repository snapshots and traceable retrieval evidence.
CREATE TYPE "DocumentVersionStatus" AS ENUM ('BUILDING', 'READY', 'FAILED');
CREATE TYPE "RepositorySnapshotStatus" AS ENUM ('BUILDING', 'READY', 'FAILED');
CREATE TYPE "CodeRelationType" AS ENUM ('CALLS', 'IMPORTS', 'IMPLEMENTS', 'EXTENDS', 'REFERENCES', 'TESTS');
CREATE TYPE "RetrievalRoute" AS ENUM ('DOCUMENT', 'CODE', 'MIXED', 'TASK_STATE', 'CONVERSATION');
CREATE TYPE "DisclosureLevel" AS ENUM ('L0', 'L1', 'L2');

CREATE TABLE "knowledge_sources" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "external_key" VARCHAR NOT NULL,
  "title" VARCHAR NOT NULL,
  "source_type" VARCHAR NOT NULL,
  "canonical_uri" TEXT NOT NULL,
  "acl" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "knowledge_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "knowledge_sources_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "document_versions" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "source_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "content_hash" VARCHAR NOT NULL,
  "status" "DocumentVersionStatus" NOT NULL DEFAULT 'BUILDING',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ready_at" TIMESTAMPTZ,
  CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_versions_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_versions_source_id_fkey" FOREIGN KEY ("source_id")
    REFERENCES "knowledge_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "document_nodes" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "document_version_id" UUID NOT NULL,
  "parent_id" UUID,
  "stable_key" VARCHAR NOT NULL,
  "node_type" VARCHAR NOT NULL,
  "title" TEXT,
  "ordinal" INTEGER NOT NULL,
  "depth" SMALLINT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "document_nodes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_nodes_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_nodes_document_version_id_fkey" FOREIGN KEY ("document_version_id")
    REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_nodes_parent_id_fkey" FOREIGN KEY ("parent_id")
    REFERENCES "document_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "document_chunks" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "document_version_id" UUID NOT NULL,
  "node_id" UUID NOT NULL,
  "ordinal" INTEGER NOT NULL,
  "content" TEXT NOT NULL,
  "content_hash" VARCHAR NOT NULL,
  "token_count" INTEGER NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_chunks_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_chunks_document_version_id_fkey" FOREIGN KEY ("document_version_id")
    REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_chunks_node_id_fkey" FOREIGN KEY ("node_id")
    REFERENCES "document_nodes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "repository_snapshots" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "repository_id" VARCHAR NOT NULL,
  "commit_sha" VARCHAR NOT NULL,
  "status" "RepositorySnapshotStatus" NOT NULL DEFAULT 'BUILDING',
  "default_branch" VARCHAR,
  "acl" JSONB NOT NULL DEFAULT '{}',
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ready_at" TIMESTAMPTZ,
  CONSTRAINT "repository_snapshots_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "repository_snapshots_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "code_symbols" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "repository_snapshot_id" UUID NOT NULL,
  "stable_key" VARCHAR NOT NULL,
  "name" VARCHAR NOT NULL,
  "qualified_name" TEXT NOT NULL,
  "kind" VARCHAR NOT NULL,
  "path" TEXT NOT NULL,
  "start_line" INTEGER NOT NULL,
  "end_line" INTEGER NOT NULL,
  "signature" TEXT,
  "content_hash" VARCHAR NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "code_symbols_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "code_symbols_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "code_symbols_repository_snapshot_id_fkey" FOREIGN KEY ("repository_snapshot_id")
    REFERENCES "repository_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "code_relations" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "repository_snapshot_id" UUID NOT NULL,
  "source_symbol_id" UUID NOT NULL,
  "target_symbol_id" UUID NOT NULL,
  "relation_type" "CodeRelationType" NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "code_relations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "code_relations_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "code_relations_repository_snapshot_id_fkey" FOREIGN KEY ("repository_snapshot_id")
    REFERENCES "repository_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "code_relations_source_symbol_id_fkey" FOREIGN KEY ("source_symbol_id")
    REFERENCES "code_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "code_relations_target_symbol_id_fkey" FOREIGN KEY ("target_symbol_id")
    REFERENCES "code_symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "retrieval_traces" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "conversation_id" UUID,
  "route" "RetrievalRoute" NOT NULL,
  "disclosure_level" "DisclosureLevel" NOT NULL,
  "query_hash" VARCHAR NOT NULL,
  "request" JSONB NOT NULL,
  "summary" JSONB NOT NULL DEFAULT '{}',
  "duration_ms" INTEGER NOT NULL,
  "shadow_read" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "retrieval_traces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "retrieval_traces_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "retrieval_traces_conversation_id_fkey" FOREIGN KEY ("conversation_id")
    REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "retrieval_evidence" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "trace_id" UUID NOT NULL,
  "document_version_id" UUID,
  "document_chunk_id" UUID,
  "repository_snapshot_id" UUID,
  "code_symbol_id" UUID,
  "rank" INTEGER NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "citation" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "retrieval_evidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "retrieval_evidence_exactly_one_source" CHECK (
    (("document_version_id" IS NOT NULL)::int + ("repository_snapshot_id" IS NOT NULL)::int) = 1
  ),
  CONSTRAINT "retrieval_evidence_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "retrieval_evidence_trace_id_fkey" FOREIGN KEY ("trace_id")
    REFERENCES "retrieval_traces"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "retrieval_evidence_document_version_id_fkey" FOREIGN KEY ("document_version_id")
    REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "retrieval_evidence_document_chunk_id_fkey" FOREIGN KEY ("document_chunk_id")
    REFERENCES "document_chunks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "retrieval_evidence_repository_snapshot_id_fkey" FOREIGN KEY ("repository_snapshot_id")
    REFERENCES "repository_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "retrieval_evidence_code_symbol_id_fkey" FOREIGN KEY ("code_symbol_id")
    REFERENCES "code_symbols"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "conversation_summaries" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "through_message_id" UUID NOT NULL,
  "content" TEXT NOT NULL,
  "token_count" INTEGER NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "conversation_summaries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversation_summaries_organization_id_fkey" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "conversation_summaries_conversation_id_fkey" FOREIGN KEY ("conversation_id")
    REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "knowledge_sources_organization_id_external_key_key" ON "knowledge_sources"("organization_id", "external_key");
CREATE INDEX "knowledge_sources_organization_id_source_type_idx" ON "knowledge_sources"("organization_id", "source_type");
CREATE UNIQUE INDEX "document_versions_source_id_version_key" ON "document_versions"("source_id", "version");
CREATE UNIQUE INDEX "document_versions_source_id_content_hash_key" ON "document_versions"("source_id", "content_hash");
CREATE INDEX "document_versions_org_status_created_idx" ON "document_versions"("organization_id", "status", "created_at" DESC);
CREATE UNIQUE INDEX "document_nodes_document_version_id_stable_key_key" ON "document_nodes"("document_version_id", "stable_key");
CREATE INDEX "document_nodes_org_version_parent_ordinal_idx" ON "document_nodes"("organization_id", "document_version_id", "parent_id", "ordinal");
CREATE UNIQUE INDEX "document_chunks_version_node_ordinal_key" ON "document_chunks"("document_version_id", "node_id", "ordinal");
CREATE INDEX "document_chunks_organization_id_document_version_id_idx" ON "document_chunks"("organization_id", "document_version_id");
CREATE UNIQUE INDEX "repository_snapshots_org_repo_commit_key" ON "repository_snapshots"("organization_id", "repository_id", "commit_sha");
CREATE INDEX "repository_snapshots_org_repo_status_created_idx" ON "repository_snapshots"("organization_id", "repository_id", "status", "created_at" DESC);
CREATE UNIQUE INDEX "code_symbols_snapshot_stable_key_key" ON "code_symbols"("repository_snapshot_id", "stable_key");
CREATE INDEX "code_symbols_org_snapshot_name_idx" ON "code_symbols"("organization_id", "repository_snapshot_id", "name");
CREATE UNIQUE INDEX "code_relations_snapshot_source_target_type_key" ON "code_relations"("repository_snapshot_id", "source_symbol_id", "target_symbol_id", "relation_type");
CREATE INDEX "code_relations_org_snapshot_type_idx" ON "code_relations"("organization_id", "repository_snapshot_id", "relation_type");
CREATE INDEX "retrieval_traces_org_created_idx" ON "retrieval_traces"("organization_id", "created_at" DESC);
CREATE INDEX "retrieval_traces_expires_at_idx" ON "retrieval_traces"("expires_at");
CREATE UNIQUE INDEX "retrieval_evidence_trace_id_rank_key" ON "retrieval_evidence"("trace_id", "rank");
CREATE INDEX "retrieval_evidence_org_trace_idx" ON "retrieval_evidence"("organization_id", "trace_id");
CREATE INDEX "retrieval_evidence_document_version_id_idx" ON "retrieval_evidence"("document_version_id");
CREATE INDEX "retrieval_evidence_repository_snapshot_id_idx" ON "retrieval_evidence"("repository_snapshot_id");
CREATE INDEX "retrieval_evidence_expires_at_idx" ON "retrieval_evidence"("expires_at");
CREATE UNIQUE INDEX "conversation_summaries_conversation_id_version_key" ON "conversation_summaries"("conversation_id", "version");
CREATE INDEX "conversation_summaries_org_conversation_created_idx" ON "conversation_summaries"("organization_id", "conversation_id", "created_at" DESC);
CREATE INDEX "conversation_summaries_expires_at_idx" ON "conversation_summaries"("expires_at");

-- READY index boundaries are append-only. New content must create a new version/snapshot.
CREATE OR REPLACE FUNCTION prevent_ready_retrieval_boundary_mutation()
RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'READY' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'ready retrieval boundaries are immutable; create a new version or snapshot'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "document_versions_ready_immutable"
BEFORE UPDATE ON "document_versions"
FOR EACH ROW EXECUTE FUNCTION prevent_ready_retrieval_boundary_mutation();

CREATE TRIGGER "repository_snapshots_ready_immutable"
BEFORE UPDATE ON "repository_snapshots"
FOR EACH ROW EXECUTE FUNCTION prevent_ready_retrieval_boundary_mutation();

CREATE OR REPLACE FUNCTION prevent_ready_document_content_mutation()
RETURNS trigger AS $$
DECLARE
  boundary_id UUID;
BEGIN
  boundary_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."document_version_id" ELSE NEW."document_version_id" END;
  IF EXISTS (
    SELECT 1 FROM "document_versions"
    WHERE "id" = boundary_id AND "status" = 'READY'
  ) THEN
    RAISE EXCEPTION 'content of a ready document version is immutable'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE' AND OLD."document_version_id" IS DISTINCT FROM NEW."document_version_id"
    AND EXISTS (
      SELECT 1 FROM "document_versions"
      WHERE "id" = OLD."document_version_id" AND "status" = 'READY'
    )
  THEN
    RAISE EXCEPTION 'content cannot be moved out of a ready document version'
      USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "document_nodes_ready_boundary"
BEFORE INSERT OR UPDATE OR DELETE ON "document_nodes"
FOR EACH ROW EXECUTE FUNCTION prevent_ready_document_content_mutation();

CREATE TRIGGER "document_chunks_ready_boundary"
BEFORE INSERT OR UPDATE OR DELETE ON "document_chunks"
FOR EACH ROW EXECUTE FUNCTION prevent_ready_document_content_mutation();

CREATE OR REPLACE FUNCTION prevent_ready_repository_content_mutation()
RETURNS trigger AS $$
DECLARE
  boundary_id UUID;
BEGIN
  boundary_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."repository_snapshot_id" ELSE NEW."repository_snapshot_id" END;
  IF EXISTS (
    SELECT 1 FROM "repository_snapshots"
    WHERE "id" = boundary_id AND "status" = 'READY'
  ) THEN
    RAISE EXCEPTION 'content of a ready repository snapshot is immutable'
      USING ERRCODE = '55000';
  END IF;
  IF TG_OP = 'UPDATE'
    AND OLD."repository_snapshot_id" IS DISTINCT FROM NEW."repository_snapshot_id"
    AND EXISTS (
      SELECT 1 FROM "repository_snapshots"
      WHERE "id" = OLD."repository_snapshot_id" AND "status" = 'READY'
    )
  THEN
    RAISE EXCEPTION 'content cannot be moved out of a ready repository snapshot'
      USING ERRCODE = '55000';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "code_symbols_ready_boundary"
BEFORE INSERT OR UPDATE OR DELETE ON "code_symbols"
FOR EACH ROW EXECUTE FUNCTION prevent_ready_repository_content_mutation();

CREATE TRIGGER "code_relations_ready_boundary"
BEFORE INSERT OR UPDATE OR DELETE ON "code_relations"
FOR EACH ROW EXECUTE FUNCTION prevent_ready_repository_content_mutation();
