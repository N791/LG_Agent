import { DocumentStructureParser } from './document-structure.parser';
import { StructuredDocumentChunker } from './structured-document.chunker';
import {
  StructuredDocumentIndexService,
  type IDocumentEmbeddingProvider,
} from './structured-document-index.service';

describe('StructuredDocumentIndexService', () => {
  const input = {
    organizationId: 'org-1',
    documentVersionId: 'version-1',
    markdown: '# Guide\n\nA body that should be indexed.',
  };

  it('is idempotent for a ready version and chunker version', async () => {
    const repository = repositoryMock();
    repository.isReady.mockResolvedValue(true);
    const embeddings = { embed: jest.fn() };
    const service = serviceWith(repository, embeddings);

    await expect(service.index(input)).resolves.toMatchObject({ reused: true, chunkCount: 0 });
    expect(embeddings.embed).not.toHaveBeenCalled();
    expect(repository.replaceBuildingIndex).not.toHaveBeenCalled();
  });

  it('publishes only after all structured chunks and embeddings are persisted', async () => {
    const repository = repositoryMock();
    repository.isReady.mockResolvedValue(false);
    const embeddings = {
      embed: jest.fn((texts: string[]) => Promise.resolve(texts.map(() => [0.1, 0.2]))),
    };
    const service = serviceWith(repository, embeddings);

    const result = await service.index(input);
    expect(result.chunkCount).toBeGreaterThan(0);
    const replaceOrder = repository.replaceBuildingIndex.mock.invocationCallOrder[0] ?? 0;
    const readyOrder = repository.markReady.mock.invocationCallOrder[0] ?? 0;
    expect(replaceOrder).toBeLessThan(readyOrder);
    expect(repository.markFailed).not.toHaveBeenCalled();
  });

  it('marks only the building version failed and never publishes partial output', async () => {
    const repository = repositoryMock();
    repository.isReady.mockResolvedValue(false);
    const embeddings = { embed: jest.fn().mockRejectedValue(new Error('vector unavailable')) };
    const service = serviceWith(repository, embeddings);

    await expect(service.index(input)).rejects.toThrow('vector unavailable');
    expect(repository.markReady).not.toHaveBeenCalled();
    expect(repository.markFailed).toHaveBeenCalledWith('org-1', 'version-1', 'vector unavailable');
  });
});

function repositoryMock() {
  return {
    isReady: jest.fn(),
    replaceBuildingIndex: jest.fn().mockResolvedValue(undefined),
    markReady: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };
}

function serviceWith(
  repository: ReturnType<typeof repositoryMock>,
  embeddings: Pick<IDocumentEmbeddingProvider, 'embed'>,
) {
  return new StructuredDocumentIndexService(
    new DocumentStructureParser(),
    new StructuredDocumentChunker(),
    repository,
    embeddings,
  );
}
