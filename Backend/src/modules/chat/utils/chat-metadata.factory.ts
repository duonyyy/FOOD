import { ChatMetadata } from '../types/chat.types';

export function createInitialChatMetadata(): ChatMetadata {
  return {
    orderItems: [],
    addresses: [],
    isOrdering: false,
    isFoodConfirmed: false,
    isRestaurantConfirmed: false,
    isAddressConfirmed: false,
    isPaymentConfirmed: false,
  };
}

export function normalizeChatMetadata(metadata?: Partial<ChatMetadata> | null): ChatMetadata {
  const initial = createInitialChatMetadata();

  if (!metadata || typeof metadata !== 'object') {
    return initial;
  }

  return {
    ...initial,
    ...metadata,
    orderItems: Array.isArray(metadata.orderItems) ? metadata.orderItems : [],
    addresses: Array.isArray(metadata.addresses) ? metadata.addresses : [],
  };
}
