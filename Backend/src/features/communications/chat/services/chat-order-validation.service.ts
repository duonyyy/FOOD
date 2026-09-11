import { Inject, Injectable } from '@nestjs/common';
import { LOCATION_READER, type LocationReaderPort } from 'src/features/locations/public-api';
import { CATALOG_CHAT_READER, type CatalogChatReaderPort } from 'src/features/menu/public-api';
import { ChatMetadata } from '../types/chat.types';

export interface ValidatedChatOrderItem {
  foodId: string;
  name: string;
  quantity: number;
  price: number;
  restaurantId: string;
}

export interface ValidatedChatOrder {
  restaurantId: string;
  addressId: string;
  paymentMethod: 'cod' | 'card';
  orderItems: ValidatedChatOrderItem[];
}

export interface ChatOrderValidationResult {
  valid: boolean;
  reason?: string;
  action?: string;
  order?: ValidatedChatOrder;
}

@Injectable()
export class ChatOrderValidationService {
  constructor(
    @Inject(CATALOG_CHAT_READER)
    private readonly catalogReader: CatalogChatReaderPort,
    @Inject(LOCATION_READER)
    private readonly locationReader: LocationReaderPort,
  ) {}

  async validate(userId: string, metadata: ChatMetadata): Promise<ChatOrderValidationResult> {
    const paymentMethod = metadata.selectedPaymentMethod;
    if (!paymentMethod) {
      return {
        valid: false,
        action: 'choosePayment',
        reason: 'Bạn muốn thanh toán bằng COD hay card?',
      };
    }

    const addressId = metadata.selectedAddress?.id;
    if (!addressId) {
      return {
        valid: false,
        action: 'chooseAddress',
        reason: 'Bạn vui lòng chọn lại địa chỉ giao hàng trước khi thanh toán.',
      };
    }

    const userAddresses = await this.locationReader.listOwnedAddresses(userId);
    const addressBelongsToUser = userAddresses.some((address) => address.addressId === addressId);
    if (!addressBelongsToUser) {
      return {
        valid: false,
        action: 'chooseAddress',
        reason: 'Địa chỉ giao hàng không hợp lệ. Bạn vui lòng chọn lại địa chỉ.',
      };
    }

    if (!metadata.orderItems.length) {
      return {
        valid: false,
        action: 'retryOrder',
        reason: 'Thông tin món ăn chưa đầy đủ. Bạn vui lòng chọn món lại.',
      };
    }

    const validatedItems: ValidatedChatOrderItem[] = [];
    let restaurantId: string | null = null;

    for (const item of metadata.orderItems) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        return {
          valid: false,
          action: 'retryOrder',
          reason: `Số lượng món "${item.name}" không hợp lệ. Bạn vui lòng chọn lại món.`,
        };
      }

      const food = await this.catalogReader.findAvailableFood(item.id, item.restaurantId);
      if (!food) {
        return {
          valid: false,
          action: 'retryOrder',
          reason: `Không tìm thấy món "${item.name}" trong thực đơn hiện tại. Bạn vui lòng chọn lại món.`,
        };
      }

      const foodRestaurantId = food.restaurantId;
      if (!foodRestaurantId) {
        return {
          valid: false,
          action: 'retryOrder',
          reason: `Không xác định được cửa hàng của món "${item.name}". Bạn vui lòng chọn lại món.`,
        };
      }

      if (!restaurantId) {
        restaurantId = foodRestaurantId;
      }

      if (restaurantId !== foodRestaurantId) {
        return {
          valid: false,
          action: 'retryOrder',
          reason: 'Các món trong đơn phải thuộc cùng một cửa hàng. Bạn vui lòng chọn lại món.',
        };
      }

      validatedItems.push({
        foodId: food.foodId,
        name: food.name,
        quantity,
        price: food.price,
        restaurantId: foodRestaurantId,
      });
    }

    if (!restaurantId) {
      return {
        valid: false,
        action: 'retryOrder',
        reason: 'Không xác định được cửa hàng của đơn hàng. Bạn vui lòng chọn lại món.',
      };
    }

    return {
      valid: true,
      order: {
        restaurantId,
        addressId,
        paymentMethod,
        orderItems: validatedItems,
      },
    };
  }

  parsePaymentMethod(userMessage: string): 'cod' | 'card' | null {
    const lowerMessage = userMessage.toLowerCase().trim();

    if (lowerMessage.includes('cod') || lowerMessage.includes('tiền mặt')) {
      return 'cod';
    }

    if (lowerMessage.includes('card') || lowerMessage.includes('thẻ')) {
      return 'card';
    }

    return null;
  }
}
