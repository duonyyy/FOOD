export const DELIVERY_COMPLETED_EVENT = 'delivery.completed';

export type DeliveryCompletedEvent = Record<string, unknown> & {
  orderId: string;
  shipperId: string;
  shippingDetailId: string;
  completedAt: string;
  earnings: number;
  deliveryTimeMinutes: number | null;
  onTime: boolean | null;
};
