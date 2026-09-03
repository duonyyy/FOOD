import { Inject, Injectable } from '@nestjs/common';
import { LOCATION_READER, type LocationReaderPort } from 'src/features/locations/public-api';
import { CHAT_ORDERING, type ChatOrderingPort } from 'src/features/orders/public-api';
import { ChatLlmService } from '../services/chat-llm.service';
import { ChatOrderValidationService } from '../services/chat-order-validation.service';
import { ChatAddress, ChatContext, ChatMetadata, ChatReply } from '../types/chat.types';

@Injectable()
export class OrderConversationFlowService {
  constructor(
    @Inject(LOCATION_READER)
    private readonly locationReader: LocationReaderPort,
    @Inject(CHAT_ORDERING)
    private readonly ordering: ChatOrderingPort,
    private readonly orderValidationService: ChatOrderValidationService,
    private readonly llmService: ChatLlmService,
  ) {}

  isStartRequest(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase();
    return lowerMessage.includes('đặt món') || lowerMessage.includes('đặt đơn');
  }

  start(metadata: ChatMetadata): ChatReply {
    metadata.isOrdering = true;

    return {
      reply: 'Vui lòng cho mình biết bạn muốn đặt món gì?',
      action: 'orderItems',
      metadata,
    };
  }

  async continue(
    userMessage: string,
    userId: string,
    metadata: ChatMetadata,
    context: ChatContext,
  ): Promise<ChatReply> {
    if (metadata.isOrdering && !metadata.isFoodConfirmed) {
      return this.collectOrderItems(userMessage, userId, metadata, context);
    }

    if (metadata.isFoodConfirmed && !metadata.isRestaurantConfirmed) {
      return this.confirmRestaurant(userMessage, userId, metadata, context);
    }

    if (metadata.isRestaurantConfirmed && !metadata.isAddressConfirmed) {
      return this.confirmAddress(userMessage, userId, metadata, context);
    }

    if (metadata.isAddressConfirmed && !metadata.isPaymentConfirmed) {
      return this.choosePayment(userMessage, metadata);
    }

    if (metadata.isPaymentConfirmed) {
      return this.placeOrder(userMessage, userId, metadata);
    }

    return {
      reply:
        'Mình chưa rõ bước tiếp theo của đơn hàng. Bạn có thể thử lại hoặc gõ "hủy" để bắt đầu lại.',
      action: 'retryOrder',
      metadata,
    };
  }

  private async collectOrderItems(
    userMessage: string,
    userId: string,
    metadata: ChatMetadata,
    context: ChatContext,
  ): Promise<ChatReply> {
    if (this.isPositiveConfirmation(userMessage)) {
      metadata.isFoodConfirmed = true;
      return this.continue('', userId, metadata, context);
    }

    const foodList = await this.llmService.parseOrderItems(userMessage, context.menuFlat);

    if (foodList.length === 0) {
      return {
        reply:
          'Mình chưa tìm thấy món phù hợp trong thực đơn. Bạn nhập lại tên món và số lượng giúp mình nhé.',
        action: 'retryOrder',
        metadata,
      };
    }

    const currentRestaurantId =
      metadata.orderItems.length > 0 ? metadata.orderItems[0].restaurantId : null;
    const differentRestaurant = foodList.some(
      (food) => currentRestaurantId && food.restaurantId !== currentRestaurantId,
    );

    if (differentRestaurant) {
      return {
        reply: 'Các món bạn chọn thuộc cửa hàng khác nhau. Vui lòng chọn món từ cùng một cửa hàng.',
        action: 'retryOrder',
        metadata,
      };
    }

    metadata.orderItems.push(...foodList);
    const currentOrderSummary = metadata.orderItems
      .map((item) => `${item.quantity} ${item.name}`)
      .join(', ');

    return {
      reply: `Đơn hàng hiện tại của bạn là: ${currentOrderSummary}. Bạn có muốn tiếp tục không?`,
      action: 'confirmOrder',
      metadata,
    };
  }

  private async confirmRestaurant(
    userMessage: string,
    userId: string,
    metadata: ChatMetadata,
    context: ChatContext,
  ): Promise<ChatReply> {
    if (this.isPositiveConfirmation(userMessage)) {
      metadata.isRestaurantConfirmed = true;
      return this.continue('', userId, metadata, context);
    }

    const restaurantName = metadata.orderItems[0]?.restaurantName || 'đã chọn';

    return {
      reply: `Món ăn đã được xác nhận. Bạn muốn giao hàng từ cửa hàng ${restaurantName} phải không?`,
      action: 'confirmRestaurant',
      metadata,
    };
  }

  private async confirmAddress(
    userMessage: string,
    userId: string,
    metadata: ChatMetadata,
    _context: ChatContext,
  ): Promise<ChatReply> {
    if (this.isPositiveConfirmation(userMessage) && metadata.selectedAddress) {
      metadata.isAddressConfirmed = true;
      return {
        reply: 'Bạn muốn thanh toán bằng COD hay card?',
        action: 'choosePayment',
        metadata,
      };
    }

    const addresses = await this.locationReader.listOwnedAddresses(userId);
    metadata.addresses = addresses.map((address) => ({
      id: address.addressId,
      street: address.street,
      ward: address.ward,
      district: address.district,
      city: address.city,
    }));

    if (!metadata.addresses.length) {
      return {
        reply: 'Bạn chưa có địa chỉ nào để giao hàng. Vui lòng thêm địa chỉ trước.',
        action: 'noAddress',
        metadata,
      };
    }

    const addressIndex = parseInt(userMessage, 10) - 1;
    if (addressIndex >= 0 && addressIndex < metadata.addresses.length) {
      const selectedAddress = metadata.addresses[addressIndex];
      return {
        reply: `Bạn đã chọn địa chỉ: ${this.formatAddress(selectedAddress)}. Bạn có xác nhận địa chỉ này không?`,
        action: 'confirmAddress',
        metadata: {
          ...metadata,
          selectedAddress,
        },
      };
    }

    const addressList = metadata.addresses
      .map((address, index) => `${index + 1}. ${this.formatAddress(address)}`)
      .join('\n');

    return {
      reply: `Đơn hàng hiện tại của bạn là ${metadata.orderItems
        .map((item) => `${item.quantity} ${item.name}`)
        .join(
          ', ',
        )}. Bạn muốn giao đến địa chỉ nào trong số các địa chỉ sau?\n${addressList}\nVui lòng chọn số thứ tự của địa chỉ.`,
      action: 'chooseAddress',
      metadata,
    };
  }

  private choosePayment(userMessage: string, metadata: ChatMetadata): ChatReply {
    const paymentMethod = this.orderValidationService.parsePaymentMethod(userMessage);
    if (!paymentMethod) {
      return {
        reply: 'Bạn muốn thanh toán bằng COD hay card?',
        action: 'choosePayment',
        metadata,
      };
    }

    metadata.selectedPaymentMethod = paymentMethod;
    metadata.isPaymentConfirmed = true;
    return {
      reply: `Bạn chọn thanh toán bằng ${paymentMethod.toUpperCase()}. Bạn có xác nhận tạo đơn không?`,
      action: 'confirmCreateOrder',
      metadata,
    };
  }

  private async placeOrder(
    userMessage: string,
    userId: string,
    metadata: ChatMetadata,
  ): Promise<ChatReply> {
    if (!this.isPositiveConfirmation(userMessage)) {
      return {
        reply:
          'Mình chưa tạo đơn. Bạn hãy trả lời "có" nếu muốn xác nhận tạo đơn, hoặc "hủy" để dừng.',
        action: 'confirmCreateOrder',
        metadata,
      };
    }

    const validation = await this.orderValidationService.validate(userId, metadata);
    if (!validation.valid || !validation.order) {
      return {
        reply:
          validation.reason ||
          'Thông tin đơn hàng chưa đầy đủ. Bạn vui lòng thử lại hoặc gõ "hủy" để bắt đầu lại.',
        action: validation.action || 'retryOrder',
        metadata,
      };
    }

    const orderResponse = await this.ordering.createOrder({
      customerId: userId,
      restaurantId: validation.order.restaurantId,
      addressId: validation.order.addressId,
      paymentMethod: validation.order.paymentMethod,
      items: validation.order.orderItems.map((item) => ({
        foodId: item.foodId,
        quantity: item.quantity,
      })),
    });

    metadata.isPaymentConfirmed = false;
    metadata.selectedPaymentMethod = undefined;
    metadata.isOrdering = false;
    metadata.isFoodConfirmed = false;
    metadata.isRestaurantConfirmed = false;
    metadata.isAddressConfirmed = false;
    metadata.orderItems = [];
    metadata.selectedAddress = undefined;

    return {
      reply: `Đơn hàng của bạn đã được tạo thành công. Bạn có thể xem chi tiết đơn hàng tại: https://foodee-fe.onrender.com/order/${orderResponse.orderId}. Tổng tiền: ${orderResponse.total}. Cảm ơn bạn đã sử dụng dịch vụ của Foodee <3.`,
      action: 'placeOrder',
      metadata: { ...metadata, orderId: orderResponse.orderId, total: orderResponse.total },
    };
  }

  private isPositiveConfirmation(userMessage: string): boolean {
    const lowerMessage = userMessage.normalize('NFC').toLowerCase();
    const tokenBoundary = '(?:^|[^\\p{L}\\p{N}_])';
    const endBoundary = '(?=$|[^\\p{L}\\p{N}_])';

    if (
      new RegExp(`${tokenBoundary}(không|hủy|huỷ|no|cancel)${endBoundary}`, 'u').test(lowerMessage)
    ) {
      return false;
    }

    return new RegExp(
      `${tokenBoundary}(có|ok|okay|đồng ý|xác nhận|tiếp tục|yes)${endBoundary}`,
      'u',
    ).test(lowerMessage);
  }

  private formatAddress(address: ChatAddress): string {
    return [address?.street, address?.ward, address?.district, address?.city]
      .filter(Boolean)
      .join(', ');
  }
}
