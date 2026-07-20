import { DiscussionDTO, CreateDiscussionDTO, AddCommentDTO, UpdateDiscussionStatusDTO, AssignDiscussionDTO, DiscussionAnalyticsDTO } from '@lg-agent/contracts';
import api from './api';

export const DiscussionApi = {
  getDiscussions: async (taskId?: string, workspaceId?: string): Promise<DiscussionDTO[]> => {
    const params = new URLSearchParams();
    if (taskId) params.append('taskId', taskId);
    if (workspaceId) params.append('workspaceId', workspaceId);

    const response = await api.get<DiscussionDTO[]>(`/discussions?${params.toString()}`);
    return response.data;
  },

  getDiscussionDetails: async (id: string): Promise<DiscussionDTO> => {
    const response = await api.get<DiscussionDTO>(`/discussions/${id}`);
    return response.data;
  },

  createDiscussion: async (dto: CreateDiscussionDTO): Promise<DiscussionDTO> => {
    const response = await api.post<DiscussionDTO>('/discussions', dto);
    return response.data;
  },

  addComment: async (id: string, dto: AddCommentDTO): Promise<DiscussionDTO> => {
    const response = await api.post<DiscussionDTO>(`/discussions/${id}/comments`, dto);
    return response.data;
  },

  updateStatus: async (id: string, status: string): Promise<DiscussionDTO> => {
    const dto: UpdateDiscussionStatusDTO = { status };
    const response = await api.patch<DiscussionDTO>(`/discussions/${id}/status`, dto);
    return response.data;
  },

  assignDiscussion: async (id: string, assignedToId: string): Promise<DiscussionDTO> => {
    const dto: AssignDiscussionDTO = { assignedToId };
    const response = await api.post<DiscussionDTO>(`/discussions/${id}/assign`, dto);
    return response.data;
  },

  resolveDiscussion: async (id: string): Promise<DiscussionDTO> => {
    const response = await api.post<DiscussionDTO>(`/discussions/${id}/resolve`);
    return response.data;
  },

  getAnalytics: async (): Promise<DiscussionAnalyticsDTO> => {
    const response = await api.get<DiscussionAnalyticsDTO>('/discussions/analytics');
    return response.data;
  },
};
