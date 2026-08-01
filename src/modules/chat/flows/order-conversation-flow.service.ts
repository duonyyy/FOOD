import { Injectable } from '@nestjs/common';
import { AddressService } from 'src/modules/address/address.service';
import { CreateOrderDetailDto } from 'src/modules/order/dto/create-order.dto';
import { OrderService } from 'src/modules/order/order.service';
import { RestaurantService } from 'src/modules/restaurant/restaurant.service';
import { ChatLlmService } from '../services/chat-llm.service';
import { ChatOrderValidationService } from '../services/chat-order-validation.service';

import { OrderCreatedPublisher } from '../services/order-created-publisher.service';
import { ChatContext, ChatMetadata, ChatReply } from '../types/chat.types';

@Injectable()
export class OrderConversationFlowService {
  constructor(
    private readonly addressService: AddressService,
    private readonly orderService: OrderService,
    private readonly restaurantService: RestaurantService,
    private readonly orderValidationService: ChatOrderValidationService,
    private readonly llmService: ChatLlmService,
    private readonly orderCreatedPublisher: OrderCreatedPublisher,
  ) {}

  isStartRequest(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase();
    return lowerMessage.includes('đặt món') || lowerMessage.includes('đặt đơn');
  }

  async start(metadata: ChatMetadata): Promise<ChatReply> {
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

    const restaurantId = metadata.orderItems[0]?.restaurantId;
    const restaurantName = restaurantId
      ? await this.restaurantService.getNameById(restaurantId)
      : 'đã chọn';

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
    context: ChatContext,
  ): Promise<ChatReply> {
    if (this.isPositiveConfirmation(userMessage) && metadata.selectedAddress) {
      metadata.isAddressConfirmed = true;
      return {
        reply: 'Bạn muốn thanh toán bằng COD hay card?',
        action: 'choosePayment',
        metadata,
      };
    }

    metadata.addresses = await this.addressService.getAddresseByUser(userId);

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

  private async placeOrder(
    userMessage: string,
    userId: string,
    metadata: ChatMetadata,
  ): Promise<ChatReply> {
    const validation = await this.orderValidationService.validate(userId, userMessage, metadata);
    if (!validation.valid || !validation.order) {
      return {
        reply:
          validation.reason ||
          'Thông tin đơn hàng chưa đầy đủ. Bạn vui lòng thử lại hoặc gõ "hủy" để bắt đầu lại.',
        action: validation.action || 'retryOrder',
        metadata,
      };
    }

    const orderDetails: CreateOrderDetailDto[] = validation.order.orderItems.map((item) => ({
      foodId: item.foodId,
      quantity: item.quantity.toString(),
      price: item.price.toString(),
    }));

    const orderResponse = await this.orderService.createOrder({
      userId,
      restaurantId: validation.order.restaurantId,
      addressId: validation.order.addressId,
      orderDetails,
      paymentMethod: validation.order.paymentMethod,
      promotionCode: undefined,
    });

    await this.orderCreatedPublisher.publish(orderResponse);

    metadata.isPaymentConfirmed = false;
    metadata.isOrdering = false;
    metadata.isFoodConfirmed = false;
    metadata.isRestaurantConfirmed = false;
    metadata.isAddressConfirmed = false;
    metadata.orderItems = [];
    metadata.selectedAddress = undefined;

    return {
      reply: `Đơn hàng của bạn đã được tạo thành công. Bạn có thể xem chi tiết đơn hàng tại: https://foodee-fe.onrender.com/order/${orderResponse.id}. Tổng tiền: ${orderResponse.total}. Cảm ơn bạn đã sử dụng dịch vụ của Foodee <3.`,
      action: 'placeOrder',
      metadata: { orderId: orderResponse.id, total: orderResponse.total, ...metadata },
    };
  }

  private isPositiveConfirmation(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase();
    return (
      lowerMessage.includes('xác nhận') ||
      lowerMessage.includes('tiếp tục') ||
      lowerMessage.includes('có')
    );
  }

  private formatAddress(address: any): string {
    return [address?.street, address?.ward, address?.district, address?.city]
      .filter(Boolean)
      .join(', ');
  }
}
