export const ORDER_MESSAGING_READER = Symbol('ORDER_MESSAGING_READER');

export interface OrderMessagingReaderPort {
  findOrderForMessaging(orderId: string): Promise<OrderMessagingSnapshot | null>;
  listCustomerShipperChatPartners(customerId: string): Promise<OrderMessagingSnapshot[]>;
}

export interface OrderMessagingSnapshot {
  orderId: string;
  customerId: string;
  status: string;
  shipperId: string | null;
}
