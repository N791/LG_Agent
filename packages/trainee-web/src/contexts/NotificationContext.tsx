import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { NotificationDTO } from '@lg-agent/contracts';
import { notificationService } from '../services/notification.service';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { message } from 'antd';

interface NotificationContextValue {
  notifications: NotificationDTO[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  archive: (id: string) => Promise<void>;
  hasMore: boolean;
  loadMore: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = useSelector((state: RootState) => state.auth.token);
  const [notifications, setNotifications] = useState<NotificationDTO[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const LIMIT = 20;

  const fetchInitialData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [notifsData, count] = await Promise.all([
        notificationService.getNotifications({ limit: LIMIT, offset: 0 }),
        notificationService.getUnreadCount()
      ]);
      setNotifications(notifsData.items);
      setHasMore(notifsData.total > LIMIT);
      setOffset(LIMIT);
      setUnreadCount(count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  const connectSocket = useCallback(async () => {
    if (!token) return;
    try {
      const socket = await notificationService.connectSocket(token);

      socket.on('notification:new', (notification: NotificationDTO) => {
        setNotifications(prev => [notification, ...prev]);
        setUnreadCount(prev => prev + 1);
        message.info(notification.title);
      });

      socket.on('notification:count', (data: { count: number }) => {
        setUnreadCount(data.count);
      });

    } catch (error) {
      console.error('Socket connection failed:', error);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchInitialData();
      connectSocket();
    } else {
      setNotifications([]);
      setUnreadCount(0);
      notificationService.disconnectSocket();
    }

    return () => {
      notificationService.disconnectSocket();
    };
  }, [token, fetchInitialData, connectSocket]);

  const loadMore = async () => {
    if (loading || !hasMore) return;
    try {
      setLoading(true);
      const data = await notificationService.getNotifications({ limit: LIMIT, offset });
      setNotifications(prev => [...prev, ...data.items]);
      setOffset((prev) => prev + LIMIT);
      setHasMore(offset + data.items.length < data.total);
    } catch (error) {
      console.error('Failed to load more notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev =>
        prev.map(n => n.id === id ? { ...n, status: 'READ' as any } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev =>
        prev.map(n => ({ ...n, status: 'READ' as any }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const archive = async (id: string) => {
    try {
      await notificationService.archive(id);
      setNotifications(prev => prev.filter((n) => n.id !== id));
      setUnreadCount((prev) => {
        const target = notifications.find((n) => n.id === id);
        return target?.status === 'UNREAD' ? Math.max(0, prev - 1) : prev;
      });
    } catch (error) {
      console.error('Failed to archive notification:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        refreshNotifications: fetchInitialData,
        markAsRead,
        markAllAsRead,
        archive,
        hasMore,
        loadMore
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
