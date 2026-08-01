import { Injectable } from '@nestjs/common';
import { Food } from 'src/entities/food.entity';
import { AddressService } from 'src/modules/address/address.service';
import { FoodService } from 'src/modules/food/food.service';
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
    private readonly foodService: FoodService,
    private readonly addressService: AddressService,
  ) {}

  async validate(
    userId: string,
    userMessage: string,
    metadata: ChatMetadata,
  ): Promise<ChatOrderValidationResult> {
    const paymentMethod = this.parsePaymentMethod(userMessage);
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

    const userAddresses = await this.addressService.getAddresseByUser(userId);
    const addressBelongsToUser = userAddresses.some((address) => address.id === addressId);
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

      const food = await this.findFood(item.id);
      if (!food) {
        return {
          valid: false,
          action: 'retryOrder',
          reason: `Không tìm thấy món "${item.name}" trong thực đơn hiện tại. Bạn vui lòng chọn lại món.`,
        };
      }

      const foodRestaurantId = food?.restaurant?.id;
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
        foodId: food.id,
        name: food.name,
        quantity,
        price: Number(food.price || 0),
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

  private parsePaymentMethod(userMessage: string): 'cod' | 'card' | null {
    const lowerMessage = userMessage.toLowerCase().trim();

    if (lowerMessage.includes('cod') || lowerMessage.includes('tiền mặt')) {
      return 'cod';
    }

    if (lowerMessage.includes('card') || lowerMessage.includes('thẻ')) {
      return 'card';
    }

    return null;
  }

  private async findFood(foodId: string): Promise<Food | null> {
    try {
      return await this.foodService.findOne(foodId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[ChatOrderValidation] Cannot find food:', message);
      return null;
    }
  }
}
