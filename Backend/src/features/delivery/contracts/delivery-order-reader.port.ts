export const DELIVERY_ORDER_READER = Symbol('DELIVERY_ORDER_READER');

export interface DeliveryOrderSnapshot {
  id: string;
  status: string;
  shippingFee?: number | null;
  shipperEarnings?: number | null;
  deliveryDistance?: number | null;
  restaurant?: {
    latitude?: number | string | null;
    longitude?: number | string | null;
  } | null;
  shippingDetail?: unknown;
}

export interface DeliveryOrderReaderPort {
  findOrderForDeliveryAssignment(orderId: string): Promise<DeliveryOrderSnapshot | null>;
}
