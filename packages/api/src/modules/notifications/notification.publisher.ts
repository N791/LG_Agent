import { Injectable, Logger } from '@nestjs/common';
import {
  INotificationPublisher,
  NotificationPublishEvent,
} from './notification-publisher.interface';
import { NotificationService } from './notification.service';
import { NotificationGateway } from './notification.gateway';

/**
 * MVP implementation of NotificationPublisher.
 * - Checks user preferences.
 * - Persists notification to the database.
 * - Pushes via WebSocket gateway.
 *
 * Future: can be swapped for Kafka/RabbitMQ/Email/Push without
 * changing any business module code.
 */
@Injectable()
export class NotificationPublisher implements INotificationPublisher {
  private readonly logger = new Logger(NotificationPublisher.name);

  constructor(
    private readonly notificationService: NotificationService,
    private readonly gateway: NotificationGateway,
  ) {}

  async publish(event: NotificationPublishEvent): Promise<void> {
    try {
      // 1. Check if user has disabled this notification type
      const enabled = await this.notificationService.isNotificationEnabled(
        event.userId,
        event.type,
      );
      if (!enabled) {
        this.logger.debug(
          `Notification type ${event.type} disabled for user ${event.userId}, skipping.`,
        );
        return;
      }

      // 2. Persist
      const notification = await this.notificationService.create({
        userId: event.userId,
        type: event.type,
        priority: event.priority,
        title: event.title,
        message: event.message,
        payload: event.payload,
        expiresAt: event.expiresAt,
      });

      // 3. Push via WebSocket
      this.gateway.pushNotification(event.userId, notification);

      // 4. Push updated unread count
      const count = await this.notificationService.getUnreadCount(event.userId);
      this.gateway.pushUnreadCount(event.userId, count);

      this.logger.log(
        `Published ${event.type} notification to user ${event.userId}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to publish notification: ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
