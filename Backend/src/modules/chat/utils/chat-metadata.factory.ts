import { ChatAddress, ChatMetadata, ChatOrderItem, QuickOrderOption } from '../types/chat.types';

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
    isOrdering: metadata.isOrdering === true,
    isFoodConfirmed: metadata.isFoodConfirmed === true,
    isRestaurantConfirmed: metadata.isRestaurantConfirmed === true,
    isAddressConfirmed: metadata.isAddressConfirmed === true,
    isPaymentConfirmed: metadata.isPaymentConfirmed === true,
    isQuickReorder: metadata.isQuickReorder === true,
    orderItems: normalizeOrderItems(metadata.orderItems),
    addresses: normalizeAddresses(metadata.addresses),
    selectedAddress: normalizeAddress(metadata.selectedAddress),
    selectedPaymentMethod:
      metadata.selectedPaymentMethod === 'cod' || metadata.selectedPaymentMethod === 'card'
        ? metadata.selectedPaymentMethod
        : undefined,
    quickOrderOptions: Array.isArray(metadata.quickOrderOptions)
      ? metadata.quickOrderOptions
          .filter((option) => option && typeof option === 'object')
          .flatMap((option) => {
            const normalized = normalizeQuickOrderOption(option);
            return normalized ? [normalized] : [];
          })
      : undefined,
    pendingQuickOrder: normalizeQuickOrderOption(metadata.pendingQuickOrder),
  };
}

function normalizeQuickOrderOption(value: unknown): QuickOrderOption | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.orderId !== 'string' ||
    !Number.isFinite(candidate.totalAmount) ||
    !Array.isArray(candidate.orderDetails)
  ) {
    return undefined;
  }

  const orderDetails = candidate.orderDetails.flatMap((detail) => {
    if (!detail || typeof detail !== 'object') return [];
    const item = detail as Record<string, unknown>;
    if (
      typeof item.foodName !== 'string' ||
      !Number.isInteger(item.quantity) ||
      Number(item.quantity) <= 0 ||
      !Number.isFinite(item.price)
    ) {
      return [];
    }
    return [
      {
        foodId: typeof item.foodId === 'string' ? item.foodId : undefined,
        foodName: item.foodName,
        quantity: Number(item.quantity),
        price: Number(item.price),
      },
    ];
  });

  if (!orderDetails.length) return undefined;
  return {
    orderId: candidate.orderId,
    restaurantId: typeof candidate.restaurantId === 'string' ? candidate.restaurantId : undefined,
    totalAmount: Number(candidate.totalAmount),
    orderDetails,
  };
}

function normalizeOrderItems(value: unknown): ChatOrderItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.name !== 'string' ||
      typeof candidate.restaurantId !== 'string' ||
      !Number.isInteger(candidate.quantity) ||
      Number(candidate.quantity) <= 0
    ) {
      return [];
    }
    return [
      {
        id: candidate.id,
        name: candidate.name,
        quantity: Number(candidate.quantity),
        price: 0,
        restaurantId: candidate.restaurantId,
        restaurantName:
          typeof candidate.restaurantName === 'string' ? candidate.restaurantName : undefined,
      },
    ];
  });
}

function normalizeAddresses(value: unknown): ChatAddress[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((address) => {
    const normalized = normalizeAddress(address);
    return normalized ? [normalized] : [];
  });
}

function normalizeAddress(value: unknown): ChatAddress | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.id !== 'string' ||
    typeof candidate.street !== 'string' ||
    typeof candidate.city !== 'string'
  ) {
    return undefined;
  }
  return {
    id: candidate.id,
    street: candidate.street,
    ward: typeof candidate.ward === 'string' ? candidate.ward : null,
    district: typeof candidate.district === 'string' ? candidate.district : null,
    city: candidate.city,
  };
}
