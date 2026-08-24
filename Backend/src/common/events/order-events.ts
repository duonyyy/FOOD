export const ORDER_CREATED_EVENT = 'ordering.order.created';
export const ORDER_CONFIRMED_EVENT = 'ordering.order.confirmed';
export const ORDER_CANCELLED_EVENT = 'ordering.order.cancelled';
export const ORDER_PAID_EVENT = 'ordering.order.paid';

export interface OrderLifecycleEvent {
  orderId: string;
  customerId?: string;
  status: string;
  occurredAt: string;
}

export type OrderCreatedEvent = OrderLifecycleEvent & { status: 'pending' | 'processing_payment' };
export type OrderConfirmedEvent = OrderLifecycleEvent & { status: 'confirmed' };
export type OrderCancelledEvent = OrderLifecycleEvent & { status: 'canceled' };
export type OrderPaidEvent = OrderLifecycleEvent & { status: 'completed' };
