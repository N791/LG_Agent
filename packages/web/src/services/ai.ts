import request from '../utils/request';
import { ModelInfoDTO } from '@lg-agent/contracts';

export const aiService = {
  getModels: async (): Promise<ModelInfoDTO[]> => {
    const res = await request.get<unknown, ModelInfoDTO[]>('/ai/models');
    return res;
  },
};
