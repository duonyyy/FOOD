/** Minimal, read-only order data shared with Analytics. */
export interface OrderAnalyticsData {
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
  items: OrderAnalyticsData[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}
