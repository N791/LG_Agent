export enum NotificationType {
  TASK_COMPLETED = 'TASK_COMPLETED',
  TASK_FAILED = 'TASK_FAILED',
  BADGE_AWARDED = 'BADGE_AWARDED',
  COURSE_UNLOCKED = 'COURSE_UNLOCKED',
  AI_REVIEW_READY = 'AI_REVIEW_READY',
  NEW_DISCUSSION = 'NEW_DISCUSSION',
  MENTOR_REPLY = 'MENTOR_REPLY',
  MENTOR_MENTION = 'MENTOR_MENTION',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
}

export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  message: string;
  payload?: Record<string, unknown>;
  expiresAt?: string;
  createdAt: string;
}

export interface NotificationPreferenceDTO {
  type: NotificationType;
  enabled: boolean;
}

export interface NotificationListQueryDTO {
  status?: NotificationStatus;
  limit?: number;
  offset?: number;
}

export interface UpdateProfileDTO {
  nickname?: string;
  email?: string;
}

export interface ChangePasswordDTO {
  currentPassword: string;
  newPassword: string;
}

export interface UserPreferenceDTO {
  key: string;
  value: string;
}
