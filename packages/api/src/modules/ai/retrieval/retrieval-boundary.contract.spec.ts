import fs from 'node:fs';
import path from 'node:path';

describe('retrieval architecture boundary', () => {
  it('keeps controllers, Tutor strategies, and Prompt Builder away from index adapters', () => {
    const aiRoot = path.resolve(__dirname, '..');
    const files = [
      path.join(aiRoot, 'ai.controller.ts'),
      path.join(aiRoot, 'prompt-builder.service.ts'),
      ...fs
        .readdirSync(path.join(aiRoot, 'tutor', 'strategies'))
        .filter((name) => name.endsWith('.ts'))
        .map((name) => path.join(aiRoot, 'tutor', 'strategies', name)),
    ];
    const forbidden =
      /rag\/(?:pgvector|memory-vector)|VECTOR_STORE|prisma\.(?:knowledgeVector|documentChunk|codeSymbol|codeRelation)/;

    for (const file of files) {
      expect(fs.readFileSync(file, 'utf8')).not.toMatch(forbidden);
    }
  });

  it('locks ready boundaries and their citation-bearing children in the migration', () => {
    const migration = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../../../prisma/migrations/20260728030000_epic74_retrieval_contracts/migration.sql',
      ),
      'utf8',
    );

    expect(migration).toContain('document_versions_ready_immutable');
    expect(migration).toContain('repository_snapshots_ready_immutable');
    expect(migration).toContain('document_chunks_ready_boundary');
    expect(migration).toContain('code_symbols_ready_boundary');
    expect(migration).toContain('BEFORE INSERT OR UPDATE OR DELETE');
  });
});
