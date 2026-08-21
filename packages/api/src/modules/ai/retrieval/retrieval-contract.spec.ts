import {
  DisclosureLevelDTO,
  RETRIEVAL_TOOL_CONTRACTS,
  RetrievalRouteDTO,
  type EvidenceDTO,
} from '@lg-agent/contracts';
import { LegacyDocumentRetrieverAdapter } from './legacy-document-retriever.adapter';
import { AstCodeRetrieverAdapter } from './code/ast-code-retriever.adapter';
import type { ICodeRetrievalStore } from './code/code-retrieval.store';
import { QueryRouterService } from './query-router.service';
import type { RagService } from '../rag/rag.service';

const scope = {
  organizationId: '22222222-2222-4222-8222-222222222222',
  userId: '11111111-1111-4111-8111-111111111111',
};

function expectSharedEvidenceContract(evidence: EvidenceDTO, route: RetrievalRouteDTO): void {
  expect(typeof evidence.id).toBe('string');
  expect(evidence.organizationId).toBe(scope.organizationId);
  expect(evidence.route).toBe(route);
  expect(evidence.disclosureLevel).toMatch(/^L[0-2]$/);
  expect(typeof evidence.content).toBe('string');
  expect(typeof evidence.score).toBe('number');
  expect(typeof evidence.citation.id).toBe('string');
  expect(evidence.citation.organizationId).toBe(scope.organizationId);
  expect(typeof evidence.citation.uri).toBe('string');
  expect(typeof evidence.citation.revision).toBe('string');
  expect(typeof evidence.citation.locator).toBe('object');
}

describe('retrieval contracts', () => {
  it('publishes the five stable tool contracts', () => {
    expect(RETRIEVAL_TOOL_CONTRACTS.map(({ name }) => name)).toEqual([
      'search_documents',
      'expand_document',
      'search_symbols',
      'read_symbol',
      'expand_symbol',
    ]);
    for (const tool of RETRIEVAL_TOOL_CONTRACTS) {
      expect(tool.inputSchema.required).toEqual(
        expect.arrayContaining(['organizationId', 'userId']),
      );
    }
  });

  it('maps legacy document results to shared evidence and pins citations by content', async () => {
    const search = jest
      .fn()
      .mockResolvedValueOnce([
        {
          chunk: { id: 'chunk-1', content: 'first body', metadata: { source: 'guide.md' } },
          score: 0.9,
        },
      ])
      .mockResolvedValueOnce([
        {
          chunk: { id: 'chunk-1', content: 'changed body', metadata: { source: 'guide.md' } },
          score: 0.9,
        },
      ]);
    const adapter = new LegacyDocumentRetrieverAdapter({ search } as unknown as RagService);
    const input = { ...scope, query: 'guide', disclosureLevel: DisclosureLevelDTO.L1 };

    const [first] = await adapter.searchDocuments(input);
    const [changed] = await adapter.searchDocuments(input);
    if (!first || !changed) throw new Error('Expected both retrieval results');

    expectSharedEvidenceContract(first, RetrievalRouteDTO.DOCUMENT);
    expect(first.citation.documentVersionId).not.toBe(changed.citation.documentVersionId);
    expect(first.citation.revision).not.toBe(changed.citation.revision);
  });

  it('keeps the code retriever behind the same evidence-returning contract', async () => {
    const store = {
      search: jest.fn().mockResolvedValue([]),
      read: jest.fn().mockResolvedValue(undefined),
      relations: jest.fn().mockResolvedValue([]),
      readMany: jest.fn().mockResolvedValue([]),
    } as ICodeRetrievalStore;
    const adapter = new AstCodeRetrieverAdapter(store);
    await expect(adapter.searchSymbols({ ...scope, query: 'ExampleClass' })).resolves.toEqual([]);
    await expect(
      adapter.readSymbol({
        ...scope,
        repositorySnapshotId: 'snapshot-1',
        symbolId: 'symbol-1',
      }),
    ).rejects.toMatchObject({ code: 'RETRIEVAL_EVIDENCE_NOT_FOUND' });
  });

  it('routes document, code, and mixed queries without adapter knowledge', async () => {
    const router = new QueryRouterService();
    await expect(
      router.route({ ...scope, query: 'read the policy document' }),
    ).resolves.toMatchObject({
      route: RetrievalRouteDTO.DOCUMENT,
    });
    await expect(router.route({ ...scope, query: 'find class calls' })).resolves.toMatchObject({
      route: RetrievalRouteDTO.CODE,
    });
    await expect(
      router.route({ ...scope, query: 'which function implements this document requirement' }),
    ).resolves.toMatchObject({ route: RetrievalRouteDTO.MIXED });
  });
});
