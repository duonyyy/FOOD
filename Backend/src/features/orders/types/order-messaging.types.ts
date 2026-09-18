export interface OrderMessagingSnapshot {
  orderId: string;
  customerId: string;
  status: string;
  shipperId: string | null;
}
