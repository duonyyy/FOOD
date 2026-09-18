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
