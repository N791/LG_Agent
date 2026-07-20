import { NotificationType, NotificationPriority } from '@lg-agent/contracts';

/**
 * Represents an event that should generate a notification.
 * Business services publish these events without knowing
 * how notifications are stored or delivered.
 */
export interface NotificationPublishEvent {
  userId: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  expiresAt?: Date;
}

/**
 * Abstraction for publishing notifications.
 * MVP: in-process persistence + WebSocket push.
 * Future: Kafka / RabbitMQ / Email / Push.
 */
export interface INotificationPublisher {
  publish(event: NotificationPublishEvent): Promise<void>;
}

export const NOTIFICATION_PUBLISHER = Symbol('INotificationPublisher');
