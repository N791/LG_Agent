// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
export const createMockRepository = <T extends { id?: string | number }>(mockData: T[] = []) => ({
  findMany: jest.fn().mockResolvedValue(mockData),
  findUnique: jest.fn().mockImplementation((args: { where: { id: string | number } }) => {
    return Promise.resolve(mockData.find((item) => item.id === args.where.id) ?? null);
  }),
  findFirst: jest.fn().mockResolvedValue(mockData[0] ?? null),
  create: jest
    .fn()
    .mockImplementation((args: { data: Partial<T> }) =>
      Promise.resolve({ id: 'mock-id', ...args.data }),
    ),
  update: jest
    .fn()
    .mockImplementation((args: { data: Partial<T>; where: { id: string | number } }) =>
      Promise.resolve({ ...args.data, id: args.where.id }),
    ),
  delete: jest.fn().mockResolvedValue({ id: 'deleted-id' }),
  count: jest.fn().mockResolvedValue(mockData.length),
});
