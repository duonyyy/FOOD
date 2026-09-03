export const ORDER_NOTIFICATION_READER = Symbol('ORDER_NOTIFICATION_READER');

export interface OrderNotificationReaderPort {
  findNotificationRecipient(orderId: string): Promise<OrderNotificationRecipient | null>;
}

export interface OrderNotificationRecipient {
  orderId: string;
  customerId: string;
}
