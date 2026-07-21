import request from '../utils/request';

export const schemasService = {
  getAllSchemas: async () => {
    const res = await request.get<unknown, Record<string, Record<string, unknown>>>('/schemas');
    return res;
  },

  getSchema: async (name: string) => {
    const res = await request.get<unknown, Record<string, unknown>>(`/schemas/${name}`);
    return res;
  },
};
