import { PgVectorStore } from './pgvector.store';

describe('PgVectorStore contract', () => {
  it('persists chunks through a bounded Prisma transaction', async () => {
    const prisma = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (operations: Promise<number>[]) => Promise.all(operations)),
    };
    const store = new PgVectorStore(prisma as never);

    await store.addDocuments(
      [{ id: 'chunk-1', content: 'NestJS guide', metadata: { source: 'guide.md' } }],
      [[0.1, 0.2]],
    );

    expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('maps database similarity rows to the vector-store result contract', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([
        {
          id: 'chunk-1',
          content: 'NestJS guide',
          metadata: { source: 'guide.md' },
          score: 0.91,
        },
      ]),
    };
    const store = new PgVectorStore(prisma as never);

    await expect(store.search([0.1, 0.2], 3)).resolves.toEqual([
      {
        chunk: {
          id: 'chunk-1',
          content: 'NestJS guide',
          metadata: { source: 'guide.md' },
        },
        score: 0.91,
      },
    ]);
  });
});
