import request from '../utils/request';
import { User, Task } from '../types';

export interface Submission {
  id: string;
  taskId: string;
  userId: string;
  status: string;
  score: number;
  logs?: string;
  report?: any;
  createdAt: string;
  user?: User;
  task?: Task;
}

export const submissionsService = {
  findAll: async (filters: { userId?: string; courseId?: string; taskId?: string }) => {
    return request.get<Submission[]>('/v1/submissions', { params: filters });
  },

  findOne: async (id: string) => {
    return request.get<Submission>(`/v1/submissions/${id}`);
  },
};
