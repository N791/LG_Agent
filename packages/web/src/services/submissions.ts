import request from '../utils/request';
import { User, Task } from '../types';
import type { AiReviewDTO } from '@lg-agent/contracts';

export interface Submission {
  id: string;
  taskId: string;
  userId: string;
  status: string;
  score: number;
  logs?: string;
  report?: Record<string, unknown>;
  aiReview?: AiReviewDTO | null;
  createdAt: string;
  user?: User;
  task?: Task;
}

export const submissionsService = {
  findAll: async (filters: { userId?: string; courseId?: string; taskId?: string }) => {
    return request.get<Submission[]>('/submissions', { params: filters });
  },

  findOne: async (id: string) => {
    return request.get<Submission>(`/submissions/${id}`);
  },

  getAiReview: async (id: string) => {
    return request.get<unknown, AiReviewDTO>(`/ai/tutor/review/${id}`);
  },
};
