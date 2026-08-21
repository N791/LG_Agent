import { DisclosureLevelDTO, RetrievalErrorCodeDTO } from '@lg-agent/contracts';
import { HybridDocumentRetrieverAdapter } from './hybrid-document-retriever.adapter';
import { ReciprocalRankFusionService } from './reciprocal-rank-fusion.service';
import type {
  DocumentCandidate,
  IDocumentExpansionStore,
  IDocumentReranker,
  IDocumentSearchChannel,
  IRetrievalObserver,
} from './hybrid-retrieval.interfaces';

const scope = { organizationId: 'org-1', userId: 'user-1' };

describe('HybridDocumentRetrieverAdapter', () => {
  it('fuses keyword/vector ranks, records channel reasons, and pins preview citations', async () => {
    const keyword = channel([
      candidate('chunk-1', 'keyword', 0.8),
      candidate('chunk-2', 'keyword', 0.7),
    ]);
    const vector = channel([
      candidate('chunk-2', 'vector', 0.95),
      candidate('chunk-1', 'vector', 0.9),
    ]);
    const adapter = createAdapter({ keyword, vector });

    const evidence = await adapter.searchDocuments({ ...scope, query: 'ERR_AUTH_42', topK: 2 });

    expect(evidence).toHaveLength(2);
    expect(evidence[0]?.citation).toMatchObject({
      documentId: 'doc-1',
      documentVersionId: 'version-1',
      locator: { anchor: 'authentication', startLine: 10, endLine: 12 },
    });
    expect(typeof evidence[0]?.citation.chunkId).toBe('string');
    expect(evidence[0]?.citation.uri).toContain('#authentication');
    expect(evidence[0]?.metadata?.['channels']).toMatchObject({
      keyword: { hitReason: 'keyword-hit' },
      vector: { hitReason: 'vector-hit' },
    });
  });

  it('degrades independently when vector search and reranking are unavailable', async () => {
    const observations: Parameters<IRetrievalObserver['observe']>[0][] = [];
    const adapter = createAdapter({
      keyword: channel([candidate('chunk-1', 'keyword', 0.8)]),
      vector: { search: jest.fn().mockRejectedValue(new Error('pgvector offline')) },
      reranker: { rerank: jest.fn().mockRejectedValue(new Error('reranker offline')) },
      observer: { observe: (observation) => observations.push(observation) },
    });

    await expect(adapter.searchDocuments({ ...scope, query: 'exact API' })).resolves.toHaveLength(
      1,
    );
    expect(observations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ stage: 'vector', status: 'degraded' }),
        expect.objectContaining({ stage: 'rerank', status: 'degraded' }),
      ]),
    );
  });

  it('drops cross-organization candidates defensively and fails if both channels fail', async () => {
    const crossTenant = { ...candidate('leak', 'keyword', 1), organizationId: 'org-2' };
    const adapter = createAdapter({
      keyword: channel([crossTenant]),
      vector: channel([]),
    });
    await expect(adapter.searchDocuments({ ...scope, query: 'secret' })).resolves.toEqual([]);

    const failed = createAdapter({
      keyword: { search: jest.fn().mockRejectedValue(new Error('down')) },
      vector: { search: jest.fn().mockRejectedValue(new Error('down')) },
    });
    await expect(failed.searchDocuments({ ...scope, query: 'secret' })).rejects.toMatchObject({
      code: RetrievalErrorCodeDTO.ADAPTER_UNAVAILABLE,
    });
  });

  it('expands only the document version encoded by the evidence id', async () => {
    const expansion = { expand: jest.fn().mockResolvedValue([candidate('parent', 'keyword', 0)]) };
    const adapter = createAdapter({ expansion });
    await adapter.expandDocument({
      ...scope,
      evidenceId: 'document:version-1:chunk-1',
      disclosureLevel: DisclosureLevelDTO.L2,
    });
    expect(expansion.expand).toHaveBeenCalledWith(
      expect.objectContaining({ documentVersionId: 'version-1', chunkId: 'chunk-1' }),
    );
  });
});

function candidate(
  chunkId: string,
  channelName: DocumentCandidate['channel'],
  score: number,
): DocumentCandidate {
  return {
    chunkId,
    nodeId: `node-${chunkId}`,
    parentId: 'parent-node',
    documentId: 'doc-1',
    documentVersionId: 'version-1',
    version: '7',
    organizationId: 'org-1',
    sourceTitle: 'Security Guide',
    sourceUri: 'knowledge://security-guide',
    content: `Authentication ERR_AUTH_42 ${chunkId}`,
    sectionPath: ['Security', 'Authentication'],
    locator: { anchor: 'authentication', startLine: 10, endLine: 12 },
    rawScore: score,
    rawRank: 1,
    channel: channelName,
    hitReason: `${channelName}-hit`,
  };
}

function channel(value: DocumentCandidate[]): IDocumentSearchChannel {
  return { search: jest.fn().mockResolvedValue(value) };
}

function createAdapter(
  overrides: {
    keyword?: IDocumentSearchChannel;
    vector?: IDocumentSearchChannel;
    expansion?: IDocumentExpansionStore;
    reranker?: IDocumentReranker;
    observer?: IRetrievalObserver;
  } = {},
) {
  return new HybridDocumentRetrieverAdapter(
    overrides.keyword ?? channel([]),
    overrides.vector ?? channel([]),
    overrides.expansion ?? { expand: jest.fn().mockResolvedValue([]) },
    overrides.reranker ?? { rerank: jest.fn((_query, candidates) => Promise.resolve(candidates)) },
    new ReciprocalRankFusionService(),
    overrides.observer,
  );
}
