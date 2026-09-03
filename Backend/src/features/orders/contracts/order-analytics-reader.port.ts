export const ORDER_ANALYTICS_READER = Symbol('ORDER_ANALYTICS_READER');

/** Minimal, read-only order shape shared with Analytics. */
export interface OrderAnalyticsSnapshot {
  orderId: string;
  restaurantId: string | null;
  customerId: string | null;
  shipperId: string | null;
  total: number;
  status: string;
  createdAt: Date;
  deliveryCompletedAt: Date | null;
}

export interface OrderAnalyticsPage {
  items: OrderAnalyticsSnapshot[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface OrderAnalyticsReaderPort {
  findAnalyticsSnapshot(orderId: string): Promise<OrderAnalyticsSnapshot | null>;
  listAnalyticsSnapshots(page: number, pageSize: number): Promise<OrderAnalyticsPage>;
}
