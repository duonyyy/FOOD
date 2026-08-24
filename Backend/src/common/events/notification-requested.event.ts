export const NOTIFICATION_REQUESTED_EVENT = 'notification.requested';

export interface NotificationRequestedEvent {
  /** User ID who will receive the notification. */
  recipientUserId: string;
  /** Short label such as "Cập nhật trạng thái đơn hàng". */
  description: string;
  /** Human-readable message body. */
  content: string;
  /** Discriminator: 'order' | 'message' | 'system' etc. */
  type: string;
}
