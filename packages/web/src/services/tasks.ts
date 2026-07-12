import request from '../utils/request';
import { Task } from '../types';

export const tasksService = {
  getTask: async (id: string): Promise<Task> => {
    const { data } = await request.get<Task>(`/tasks/${id}`);
    return data;
  },
  
  updateTask: async (id: string, payload: Partial<Task>): Promise<Task> => {
    const { data } = await request.patch<Task>(`/tasks/${id}`, payload);
    return data;
  }
};
