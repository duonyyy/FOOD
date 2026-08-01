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
  metadata?: ChatMetadata | Record<string, any> | null;
}

export interface ChatOrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  restaurantId: string;
}

export interface ChatMenuItem extends ChatSuggestion {
  description?: string;
  restaurantId: string;
}

export interface ChatMetadata {
  orderItems: ChatOrderItem[];
  addresses: any[];
  isOrdering: boolean;
  isFoodConfirmed: boolean;
  isRestaurantConfirmed: boolean;
  isAddressConfirmed: boolean;
  isPaymentConfirmed: boolean;
  isQuickReorder?: boolean;
  quickOrderOptions?: QuickOrderOption[];
  selectedAddress?: any;
  orderId?: string;
  total?: number;
  [key: string]: any;
}

export interface QuickOrderOption {
  id?: string;
  restaurantId?: string;
  totalAmount?: number;
  orderDetails: {
    foodName: string;
    quantity: number;
    price: number | string;
  }[];
}

export interface ChatContext {
  menuFlat: ChatMenuItem[];
  orderedFoods: string[];
}
