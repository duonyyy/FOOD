export const CHAT_ORDERING = Symbol('CHAT_ORDERING');

export interface ChatOrderingPort {
  getRecentOrdersForReorder(customerId: string, limit: number): Promise<ChatReorderOrder[]>;
  createOrder(request: CreateChatOrderRequest): Promise<CreatedChatOrderSnapshot>;
}

export interface ChatReorderOrder {
  orderId: string;
  restaurantId?: string;
  totalAmount: number;
  orderDetails: Array<{
    foodId?: string;
    foodName: string;
    quantity: number;
    price: number;
  }>;
}

export interface CreateChatOrderRequest {
  customerId: string;
  restaurantId: string;
  addressId: string;
  paymentMethod: 'cod' | 'card';
  items: Array<{ foodId: string; quantity: number }>;
}

export interface CreatedChatOrderSnapshot {
  orderId: string;
  total: number;
  status: string;
}
