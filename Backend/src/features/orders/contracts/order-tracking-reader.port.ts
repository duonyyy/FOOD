export const ORDER_TRACKING_READER = Symbol('ORDER_TRACKING_READER');

export interface CustomerOrderTrackingSnapshot {
  orderId: string;
}

/** Read-only authorization lookup for a customer's delivery-tracking request. */
export interface OrderTrackingReaderPort {
  findCustomerOrderForTracking(
    orderId: string,
    customerId: string,
  ): Promise<CustomerOrderTrackingSnapshot | null>;
}
