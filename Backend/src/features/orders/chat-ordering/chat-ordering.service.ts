import { Injectable } from '@nestjs/common';
import { CreateOrderDto } from 'src/modules/order/dto/create-order.dto';
import { OrderService } from 'src/modules/order/order.service';
import {
  type ChatOrderingPort,
  type ChatReorderOrder,
  type CreateChatOrderRequest,
  type CreatedChatOrderSnapshot,
} from '../contracts/chat-ordering.port';

@Injectable()
export class ChatOrderingService implements ChatOrderingPort {
  constructor(private readonly orderService: OrderService) {}

  async getRecentOrdersForReorder(customerId: string, limit: number): Promise<ChatReorderOrder[]> {
    const orders = await this.orderService.getMinimalOrderHistoryForQuickReorder(customerId, limit);
    return orders.map((order) => ({
      orderId: order.orderId,
      restaurantId: order.restaurantId ?? undefined,
      totalAmount: Number(order.totalAmount ?? 0),
      orderDetails: order.orderDetails.map((detail) => ({
        foodId: detail.foodId ?? undefined,
        foodName: String(detail.foodName ?? ''),
        quantity: Number(detail.quantity),
        price: Number(detail.price ?? 0),
      })),
    }));
  }

  async createOrder(request: CreateChatOrderRequest): Promise<CreatedChatOrderSnapshot> {
    const dto: CreateOrderDto = {
      userId: request.customerId,
      restaurantId: request.restaurantId,
      addressId: request.addressId,
      paymentMethod: request.paymentMethod,
      orderDetails: request.items.map((item) => ({
        foodId: item.foodId,
        quantity: String(item.quantity),
        // The ordering implementation recalculates price from Catalog.
        price: '0',
        selectedToppings: [],
      })),
    };

    const order = await this.orderService.createOrder(dto);
    return {
      orderId: order.id,
      total: Number(order.total),
      status: String(order.status),
    };
  }
}
