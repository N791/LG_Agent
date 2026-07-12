import request from '../utils/request';

export const schemasService = {
  getAllSchemas: async () => {
    const { data } = await request.get<Record<string, Record<string, unknown>>>('/schemas');
    return data;
  },

  getSchema: async (name: string) => {
    const { data } = await request.get<Record<string, unknown>>(`/schemas/${name}`);
    return data;
  },
};
