export const createMockRepository = <T = any>(mockData: T[] = []) => ({
  findMany: jest.fn().mockResolvedValue(mockData),
  findUnique: jest.fn().mockImplementation((args: any) => {
    return Promise.resolve(mockData.find((item: any) => item.id === args.where.id) || null);
  }),
  findFirst: jest.fn().mockResolvedValue(mockData[0] || null),
  create: jest.fn().mockImplementation((args: any) => Promise.resolve({ id: 'mock-id', ...args.data })),
  update: jest.fn().mockImplementation((args: any) => Promise.resolve({ ...args.data, id: args.where.id })),
  delete: jest.fn().mockResolvedValue({ id: 'deleted-id' }),
  count: jest.fn().mockResolvedValue(mockData.length),
});
