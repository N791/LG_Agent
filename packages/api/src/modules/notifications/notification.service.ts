import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  NotificationDTO,
  NotificationStatus,
  NotificationPreferenceDTO,
  NotificationType,
  NotificationPriority,
} from '@lg-agent/contracts';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: {
    userId: string;
    type: string;
    priority?: string;
    title: string;
    message: string;
    payload?: Record<string, unknown>;
    expiresAt?: Date;
  }): Promise<NotificationDTO> {
    const notification = await this.prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        priority: data.priority ?? NotificationPriority.NORMAL,
        title: data.title,
        message: data.message,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any
        payload: data.payload ? (data.payload as any) : undefined,
        expiresAt: data.expiresAt ?? null,
      },
    });

    return this.toDTO(notification);
  }

  async getUserNotifications(
    userId: string,
    options: { status?: string; limit?: number; offset?: number } = {},
  ): Promise<{ items: NotificationDTO[]; total: number }> {
    const where: Record<string, unknown> = { userId };
    if (options.status) {
      where['status'] = options.status;
    }
    // Exclude archived by default unless explicitly requested
    if (!options.status) {
      where['status'] = { not: NotificationStatus.ARCHIVED };
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options.limit ?? 20,
        skip: options.offset ?? 0,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      items: items.map((n) => this.toDTO(n)),
      total,
    };
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, status: NotificationStatus.UNREAD },
    });
  }

  async markAsRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { status: NotificationStatus.READ },
    });
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { userId, status: NotificationStatus.UNREAD },
      data: { status: NotificationStatus.READ },
    });
  }

  async archive(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { status: NotificationStatus.ARCHIVED },
    });
  }

  async getPreferences(userId: string): Promise<NotificationPreferenceDTO[]> {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });

    // Return all notification types, defaulting to enabled if no preference exists
    const allTypes = Object.values(NotificationType);
    return allTypes.map((type) => {
      const pref = prefs.find((p) => (p.type as NotificationType) === type);
      return { type, enabled: pref?.enabled ?? true };
    });
  }

  async updatePreference(
    userId: string,
    type: string,
    enabled: boolean,
  ): Promise<NotificationPreferenceDTO> {
    const pref = await this.prisma.notificationPreference.upsert({
      where: { userId_type: { userId, type } },
      update: { enabled },
      create: { userId, type, enabled },
    });

    return { type: pref.type as NotificationType, enabled: pref.enabled };
  }

  async isNotificationEnabled(userId: string, type: string): Promise<boolean> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type } },
    });
    return pref?.enabled ?? true; // Default to enabled
  }

  private toDTO(notification: {
    id: string;
    type: string;
    priority: string;
    status: string;
    title: string;
    message: string;
    payload: unknown;
    expiresAt: Date | null;
    createdAt: Date;
  }): NotificationDTO {
    return {
      id: notification.id,
      type: notification.type as NotificationType,
      priority: notification.priority as NotificationPriority,
      status: notification.status as NotificationStatus,
      title: notification.title,
      message: notification.message,
      payload: (notification.payload as Record<string, unknown> | null) ?? undefined,
      expiresAt: notification.expiresAt?.toISOString(),
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
