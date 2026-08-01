import { Injectable } from '@nestjs/common';
import { AddressService } from 'src/modules/address/address.service';
import { FoodService } from 'src/modules/food/food.service';
import { CreateOrderDetailDto } from 'src/modules/order/dto/create-order.dto';
import { OrderService } from 'src/modules/order/order.service';
import { OrderCreatedPublisher } from '../services/order-created-publisher.service';
import { ChatMetadata, ChatReply } from '../types/chat.types';

@Injectable()
export class QuickReorderFlowService {
  constructor(
    private readonly orderService: OrderService,
    private readonly addressService: AddressService,
    private readonly foodService: FoodService,
    private readonly orderCreatedPublisher: OrderCreatedPublisher,
  ) {}

  isStartRequest(userMessage: string): boolean {
    const lowerMessage = userMessage.toLowerCase();
    return lowerMessage.includes('đặt lại') || lowerMessage.includes('đơn gần nhất');
  }

  async start(userId: string, metadata: ChatMetadata): Promise<ChatReply> {
    const quickOrders = await this.orderService.getMinimalOrderHistoryForQuickReorder(userId, 3);

    if (!quickOrders || quickOrders.length === 0) {
      return {
        reply: 'Bạn chưa có đơn hàng nào gần đây để đặt lại.',
        action: 'noRecentOrder',
        metadata,
      };
    }

    const quickOrdersPreview = quickOrders.map((order, index) => {
      const summary = order.orderDetails
        .map((detail) => `${detail.quantity} ${detail.foodName}`)
        .join(', ');
      return `${index + 1}. ${summary} (Tổng: ${order.totalAmount}₫)`;
    });

    metadata.quickOrderOptions = quickOrders;
    metadata.isQuickReorder = true;

    return {
      reply: `Bạn muốn đặt lại đơn nào? Vui lòng chọn số:\n${quickOrdersPreview.join('\n')}`,
      action: 'chooseQuickOrder',
      metadata,
    };
  }

  async continue(userMessage: string, userId: string, metadata: ChatMetadata): Promise<ChatReply> {
    const chosenIndex = parseInt(userMessage, 10) - 1;
    const quickOrders = await this.orderService.getMinimalOrderHistoryForQuickReorder(userId, 3);

    if (isNaN(chosenIndex) || !quickOrders?.[chosenIndex]) {
      return {
        reply: 'Lựa chọn không hợp lệ. Vui lòng chọn số đơn muốn đặt lại.',
        action: 'retryQuickOrder',
        metadata,
      };
    }

    const selectedOrder = quickOrders[chosenIndex];

    if (!selectedOrder.restaurantId) {
      return {
        reply: 'Không xác định được nhà hàng của đơn hàng này. Không thể đặt lại.',
        action: 'invalidRestaurant',
        metadata: { ...metadata, isQuickReorder: false },
      };
    }

    const fallbackAddressId = (await this.addressService.getAddresseByUser(userId))?.[0]?.id;
    if (!fallbackAddressId) {
      return {
        reply: 'Bạn chưa có địa chỉ nào để giao hàng. Vui lòng thêm địa chỉ trước.',
        action: 'noAddress',
        metadata: { ...metadata, isQuickReorder: false },
      };
    }

    const enrichedOrderDetails: CreateOrderDetailDto[] = [];

    for (const item of selectedOrder.orderDetails) {
      const food = await this.foodService.findExactFoodByName(
        item.foodName,
        selectedOrder.restaurantId,
      );
      if (!food) {
        return {
          reply: `Không thể tìm thấy món "${item.foodName}" trong thực đơn hiện tại.`,
          action: 'foodNotFound',
          metadata: { ...metadata, isQuickReorder: false },
        };
      }

      enrichedOrderDetails.push({
        foodId: food.id,
        quantity: String(item.quantity),
        price: String(item.price),
        note: '',
        discountPercent: 0,
        selectedToppings: [],
      });
    }

    const newOrder = await this.orderService.createOrder({
      userId,
      restaurantId: selectedOrder.restaurantId,
      addressId: fallbackAddressId,
      orderDetails: enrichedOrderDetails,
      paymentMethod: 'cod',
    });

    await this.orderCreatedPublisher.publish(newOrder);

    return {
      reply: `Đơn hàng của bạn đã được đặt lại thành công!\nXem tại: https://foodee-fe.onrender.com/order/${newOrder.id}`,
      action: 'quickOrderCreated',
      metadata: { ...metadata, isQuickReorder: false, orderId: newOrder.id },
    };
  }
}
