import request from '../utils/request';
import { Task } from '../types';

export const tasksService = {
  getTask: async (id: string): Promise<Task> => {
    const res = await request.get<unknown, Task>(`/tasks/${id}`);
    return res;
  },

  updateTask: async (id: string, payload: Partial<Task>): Promise<Task> => {
    const res = await request.patch<unknown, Task>(`/tasks/${id}`, payload);
    return res;
  },
};
