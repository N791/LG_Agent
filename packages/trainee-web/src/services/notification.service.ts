import api from './api';
import { NotificationDTO, NotificationPreferenceDTO } from '@lg-agent/contracts';
import { io, Socket } from 'socket.io-client';

class NotificationService {
  private socket: Socket | null = null;
  private socketConnectPromise: Promise<void> | null = null;

  async getNotifications(options?: { status?: string; limit?: number; offset?: number }) {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const res = await api.get<{ items: NotificationDTO[]; total: number }>(`/notifications?${params.toString()}`);
    return res.data;
  }

  async getUnreadCount() {
    const res = await api.get<{ count: number }>('/notifications/unread-count');
    return res.data.count;
  }

  async markAsRead(id: string) {
    await api.patch(`/notifications/${id}/read`);
  }

  async markAllAsRead() {
    await api.patch('/notifications/read-all');
  }

  async archive(id: string) {
    await api.patch(`/notifications/${id}/archive`);
  }

  async getPreferences() {
    const res = await api.get<NotificationPreferenceDTO[]>('/notifications/preferences');
    return res.data;
  }

  async updatePreference(type: string, enabled: boolean) {
    const res = await api.put<NotificationPreferenceDTO>(`/notifications/preferences/${type}`, { enabled });
    return res.data;
  }

  // --- WebSocket Logic ---

  async connectSocket(token: string): Promise<Socket> {
    if (this.socket?.connected) return this.socket;

    this.socketConnectPromise ??= new Promise((resolve, reject) => {
      // Adjust the URL if your API is not at the same host
      const envUrl = import.meta.env['VITE_API_URL'] as string | undefined;
      const API_URL = envUrl ?? 'http://localhost:3000';

      this.socket = io(`${API_URL}/notifications`, {
        auth: { token },
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        console.log('Notification socket connected');
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        console.error('Notification socket connection error:', err);
        reject(err);
      });
    });

    await this.socketConnectPromise;
    const socket = this.socket;
    if (!socket) {
      throw new Error('Socket connection failed to initialize');
    }
    return socket;
  }

  disconnectSocket() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.socketConnectPromise = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }
}

export const notificationService = new NotificationService();
