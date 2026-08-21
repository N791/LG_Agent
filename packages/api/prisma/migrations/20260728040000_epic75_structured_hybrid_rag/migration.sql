-- Epic 75: structured document chunks, hybrid keyword/vector retrieval, and pinned expansion.
ALTER TABLE "document_nodes"
  ADD COLUMN "content" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "section_path" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "locator" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "document_chunks"
  ADD COLUMN "chunker_version" VARCHAR NOT NULL DEFAULT 'structured-markdown-v1',
  ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
    to_tsvector('simple', coalesce("content", ''))
  ) STORED,
  ADD COLUMN "embedding" vector;

DROP INDEX "document_chunks_version_node_ordinal_key";
CREATE UNIQUE INDEX "document_chunks_version_chunker_node_ordinal_key"
  ON "document_chunks"("document_version_id", "chunker_version", "node_id", "ordinal");
CREATE INDEX "document_chunks_keyword_idx"
  ON "document_chunks" USING GIN ("search_vector");
CREATE INDEX "document_chunks_metadata_idx"
  ON "document_chunks" USING GIN ("metadata");

COMMENT ON COLUMN "document_chunks"."embedding"
  IS 'Embedding for the immutable chunk; null only while its document version is BUILDING.';
