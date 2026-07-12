import request from '../utils/request';
import { ModelInfoDTO } from '@lg-agent/contracts';

export const aiService = {
  getModels: async (): Promise<ModelInfoDTO[]> => {
    const { data } = await request.get<ModelInfoDTO[]>('/ai/models');
    return data;
  },
};
