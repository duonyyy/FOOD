/** Minimal order data Delivery needs to settle a completed trip. */
export interface DeliveryCompletionOrder {
  orderId: string;
  status: string;
  shippingFee: number | null;
  deliveryDistance: number | null;
  total: number | null;
  estimatedDeliveryTime: number | null;
  shipperEarnings: number | null;
}
