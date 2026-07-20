/* eslint-disable @typescript-eslint/unbound-method */
 
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { notificationService } from './notification.service';
import api from './api';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
  },
}));

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches unread count from the correct endpoint', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { count: 3 } });

    await notificationService.getUnreadCount();

    expect(api.get).toHaveBeenCalledWith('/notifications/unread-count');
  });

  it('marks notification as read using the patch endpoint', async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ data: {} });

    await notificationService.markAsRead('n1');

    expect(api.patch).toHaveBeenCalledWith('/notifications/n1/read');
  });
});
