import request from '../utils/request';
import type { SchemaId, SchemaName } from '@lg-agent/contracts';

export const schemasService = {
  getAllSchemas: async () => {
    const res = await request.get<unknown, Record<string, Record<string, unknown>>>('/schemas');
    return res;
  },

  getSchema: async (name: SchemaName | SchemaId) => {
    const res = await request.get<unknown, Record<string, unknown>>(
      `/schemas/${encodeURIComponent(name)}`,
    );
    return res;
  },
};
