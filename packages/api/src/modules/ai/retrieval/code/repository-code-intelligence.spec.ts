import { DisclosureLevelDTO } from '@lg-agent/contracts';
import { AstCodeRetrieverAdapter } from './ast-code-retriever.adapter';
import type { CodeIndex, ParsedCodeFile } from './code-intelligence.types';
import type { ICodeIndexRepository } from './code-index.service';
import { RepositoryCodeIndexService } from './code-index.service';
import type {
  CodeRelationRecord,
  CodeSymbolRecord,
  ICodeRetrievalStore,
} from './code-retrieval.store';
import { CodeLanguageDetector } from './language-detector.service';
import { CodeParserRegistry } from './parser-registry.service';
import { parseStackLocation } from './prisma-code-retrieval.store';
import { TypeScriptCodeParserAdapter } from './typescript-code-parser.adapter';

const organizationId = '22222222-2222-4222-8222-222222222222';
const userId = '11111111-1111-4111-8111-111111111111';

function requireValue<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`Missing test fixture: ${label}`);
  return value;
}

class MemoryIndexRepository implements ICodeIndexRepository {
  index?: CodeIndex;
  reusable?: ParsedCodeFile;
  ready = false;

  ensureSnapshot(): Promise<void> {
    return Promise.resolve();
  }
  isReady(): Promise<boolean> {
    return Promise.resolve(this.ready);
  }
  findReusableFile(): Promise<ParsedCodeFile | undefined> {
    return Promise.resolve(this.reusable);
  }
  replaceBuildingIndex(input: { index: CodeIndex }): Promise<void> {
    this.index = input.index;
    return Promise.resolve();
  }
  markReady(): Promise<void> {
    this.ready = true;
    return Promise.resolve();
  }
  markFailed(): Promise<void> {
    return Promise.resolve();
  }
}

describe('Epic 76 repository AST and symbol intelligence', () => {
  const files = [
    {
      path: 'src/service.ts',
      content: `
        export interface Runner { run(): string }
        export function helper(): string { return 'ok' }
        export class Service implements Runner {
          run(): string { return helper() }
        }
      `,
    },
    {
      path: 'src/service.spec.ts',
      content: `
        import { helper } from './service';
        test('helper works', () => { helper() });
      `,
    },
  ];

  it('rebuilds stable symbols and exact relations for a golden TypeScript repository', async () => {
    const parser = new TypeScriptCodeParserAdapter();
    const registry = new CodeParserRegistry();
    const repository = new MemoryIndexRepository();
    const service = new RepositoryCodeIndexService(
      new CodeLanguageDetector(),
      registry,
      parser,
      repository,
    );
    service.onModuleInit();
    const input = {
      organizationId,
      repositoryId: 'golden',
      repositoryName: 'golden',
      canonicalUri: 'https://example.test/golden',
      commitSha: 'a'.repeat(40),
      files,
    };
    const first = await service.index(input);
    const firstIndex = requireValue(repository.index, 'first index');
    repository.ready = false;
    const second = await service.index(input);
    const secondIndex = requireValue(repository.index, 'second index');

    expect(second.repositorySnapshotId).toBe(first.repositorySnapshotId);
    expect(secondIndex.symbols.map(({ id }) => id)).toEqual(firstIndex.symbols.map(({ id }) => id));
    expect(secondIndex.relations).toEqual(firstIndex.relations);
    expect(firstIndex.relations.map(({ relationType }) => relationType)).toEqual(
      expect.arrayContaining(['DEFINES', 'IMPLEMENTS', 'CALLS', 'IMPORTS', 'TESTS']),
    );
  });

  it('reuses unchanged file hashes but rebinds symbols to the new immutable snapshot', async () => {
    const parser = new TypeScriptCodeParserAdapter();
    const registry = new CodeParserRegistry();
    const repository = new MemoryIndexRepository();
    const service = new RepositoryCodeIndexService(
      new CodeLanguageDetector(),
      registry,
      parser,
      repository,
    );
    service.onModuleInit();
    await service.index({
      organizationId,
      repositoryId: 'golden',
      repositoryName: 'golden',
      canonicalUri: 'https://example.test/golden',
      commitSha: 'a'.repeat(40),
      files: [requireValue(files[0], 'service source')],
    });
    const previous = requireValue(
      requireValue(repository.index, 'initial reusable index').files[0],
      'reusable file',
    );
    const oldIds = previous.symbols.map(({ id }) => id);
    repository.ready = false;
    repository.reusable = previous;
    const result = await service.index({
      organizationId,
      repositoryId: 'golden',
      repositoryName: 'golden',
      canonicalUri: 'https://example.test/golden',
      commitSha: 'b'.repeat(40),
      files: [requireValue(files[0], 'service source')],
    });

    expect(result.reusedFileCount).toBe(1);
    expect(requireValue(repository.index, 'rebound index').symbols.map(({ id }) => id)).not.toEqual(
      oldIds,
    );
  });

  it('returns an evidenced file fallback without invented relations', async () => {
    const repository = new MemoryIndexRepository();
    const service = new RepositoryCodeIndexService(
      new CodeLanguageDetector(),
      new CodeParserRegistry(),
      new TypeScriptCodeParserAdapter(),
      repository,
    );
    service.onModuleInit();
    const result = await service.index({
      organizationId,
      repositoryId: 'mixed',
      repositoryName: 'mixed',
      canonicalUri: 'https://example.test/mixed',
      commitSha: 'c'.repeat(40),
      files: [{ path: 'main.py', content: 'def run(): pass' }],
    });

    expect(result.fallbackFileCount).toBe(1);
    const fallbackIndex = requireValue(repository.index, 'fallback index');
    expect(fallbackIndex.files[0]).toMatchObject({
      fallbackReason: 'UNSUPPORTED_LANGUAGE',
      parseConfidence: 0.1,
    });
    expect(fallbackIndex.relations).toEqual([]);
  });

  it('recognizes JavaScript stack locations without treating the stack as a fuzzy query', () => {
    expect(parseStackLocation('TypeError: failed\n    at run (src/service.ts:42:17)')).toEqual({
      path: 'src/service.ts',
      line: 42,
    });
    expect(parseStackLocation('find the Service class')).toBeUndefined();
  });

  it.each([
    {
      path: 'broken.ts',
      content: 'export function broken( {',
      reason: 'SYNTAX_ERROR',
    },
    {
      path: 'generated.js',
      content: '// @generated - do not edit\nexport function generated() {}',
      reason: 'GENERATED_CODE',
    },
  ])('uses evidence-only fallback for $reason', ({ path, content, reason }) => {
    const parsed = new TypeScriptCodeParserAdapter().parse(
      { path, content },
      '33333333-3333-4333-8333-333333333333',
    );
    expect(parsed.fallbackReason).toBe(reason);
    expect(parsed.symbols).toHaveLength(1);
    expect(parsed.unresolvedRelations).toEqual([]);
  });
});

describe('Epic 76 bounded on-demand graph expansion', () => {
  const symbol = (id: string, name: string): CodeSymbolRecord => ({
    id,
    organizationId,
    repositorySnapshotId: '33333333-3333-4333-8333-333333333333',
    repositoryId: 'golden',
    repositoryName: 'golden',
    canonicalUri: 'https://example.test/golden',
    commitSha: 'a'.repeat(40),
    name,
    qualifiedName: `src/main.ts.${name}`,
    kind: 'function',
    language: 'typescript',
    path: 'src/main.ts',
    startLine: 1,
    endLine: 2,
    summary: `function ${name}`,
    content: `function ${name}() {}`,
    parseConfidence: 1,
    score: 1,
  });
  const symbols = [symbol('a', 'a'), symbol('b', 'b'), symbol('c', 'c')];
  const relations: CodeRelationRecord[] = [
    { sourceSymbolId: 'a', targetSymbolId: 'b', relationType: 'CALLS', confidence: 1 },
    { sourceSymbolId: 'b', targetSymbolId: 'a', relationType: 'CALLS', confidence: 1 },
    {
      sourceSymbolId: 'c',
      targetSymbolId: 'a',
      relationType: 'TESTS',
      confidence: 0.7,
      heuristic: 'path',
    },
  ];
  const readMock = jest.fn(({ symbolId }: { symbolId: string }) =>
    Promise.resolve(symbols.find(({ id }) => id === symbolId)),
  );
  const store: ICodeRetrievalStore = {
    search: jest.fn().mockResolvedValue(symbols),
    read: readMock,
    relations: jest.fn().mockResolvedValue(relations),
    readMany: jest.fn(({ symbolIds }) =>
      Promise.resolve(symbols.filter(({ id }) => symbolIds.includes(id))),
    ),
  };

  it('bounds traversal, marks cycles, and preserves relation confidence', async () => {
    const adapter = new AstCodeRetrieverAdapter(store);
    const evidence = await adapter.expandSymbol({
      organizationId,
      userId,
      repositorySnapshotId: requireValue(symbols[0], 'root symbol').repositorySnapshotId,
      symbolId: 'a',
      relationTypes: ['CALLS', 'TESTED_BY'],
      depth: 3,
      limit: 4,
    });

    expect(evidence.length).toBeLessThanOrEqual(4);
    expect(evidence.map(({ metadata }) => metadata?.['relationType'])).toEqual(
      expect.arrayContaining(['CALLS', 'TESTED_BY']),
    );
    expect(evidence.some(({ metadata }) => metadata?.['cycle'] === true)).toBe(true);
    expect(evidence.every(({ disclosureLevel }) => disclosureLevel === DisclosureLevelDTO.L2)).toBe(
      true,
    );
    expect(readMock).toHaveBeenCalledWith(expect.objectContaining({ organizationId, userId }));
  });
});
