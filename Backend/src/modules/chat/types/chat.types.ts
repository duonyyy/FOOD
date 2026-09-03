export type ChatAction = string;

export interface ChatSuggestion {
  id: string;
  name: string;
  price: number;
  image: string;
  link: string;
}

export interface ChatReply {
  reply: string;
  suggestions?: ChatSuggestion[];
  action?: ChatAction;
  metadata?: ChatMetadata | Record<string, unknown> | null;
}

export interface ChatOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  restaurantId: string;
  restaurantName?: string;
}

export interface ChatMenuItem extends ChatSuggestion {
  description?: string;
  restaurantId: string;
  restaurantName?: string;
}

export interface ChatMetadata {
  orderItems: ChatOrderItem[];
  addresses: ChatAddress[];
  isOrdering: boolean;
  isFoodConfirmed: boolean;
  isRestaurantConfirmed: boolean;
  isAddressConfirmed: boolean;
  isPaymentConfirmed: boolean;
  selectedPaymentMethod?: 'cod' | 'card';
  isQuickReorder?: boolean;
  quickOrderOptions?: QuickOrderOption[];
  pendingQuickOrder?: QuickOrderOption;
  selectedAddress?: ChatAddress;
  orderId?: string;
  total?: number;
  [key: string]: unknown;
}

export interface QuickOrderOption {
  orderId: string;
  restaurantId?: string;
  totalAmount: number;
  orderDetails: {
    foodId?: string;
    foodName: string;
    quantity: number;
    price: number;
  }[];
}

export interface ChatAddress {
  id: string;
  street: string;
  ward: string | null;
  district: string | null;
  city: string;
}

export interface ChatContext {
  menuFlat: ChatMenuItem[];
  orderedFoods: string[];
}
