import { KnowledgeIndexService } from './knowledge-index.service';

describe('KnowledgeIndexService', () => {
  it('rebuilds outside startup and exposes readiness state', async () => {
    const repository = {
      getDocuments: jest
        .fn()
        .mockResolvedValue([
          { id: 'guide', title: 'Guide', content: '# Guide', source: 'guide.md' },
        ]),
    };
    const rag = {
      resetIndex: jest.fn().mockResolvedValue(undefined),
      importDocument: jest.fn().mockResolvedValue(2),
    };
    const service = new KnowledgeIndexService(repository as never, rag as never);

    expect(service.getStatus()).toEqual({ state: 'idle', indexedChunks: 0 });
    await expect(service.rebuild()).resolves.toEqual(
      expect.objectContaining({ state: 'ready', indexedChunks: 2 }),
    );
    expect(rag.resetIndex).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent rebuild requests', async () => {
    let release: (() => void) | undefined;
    const repository = {
      getDocuments: jest.fn(
        () =>
          new Promise<[]>((resolve) => {
            release = () => {
              resolve([]);
            };
          }),
      ),
    };
    const rag = { resetIndex: jest.fn().mockResolvedValue(undefined) };
    const service = new KnowledgeIndexService(repository as never, rag as never);

    const first = service.rebuild();
    const second = service.rebuild();
    release?.();
    await Promise.all([first, second]);

    expect(repository.getDocuments).toHaveBeenCalledTimes(1);
  });
});
