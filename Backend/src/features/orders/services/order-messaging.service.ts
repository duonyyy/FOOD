import { Injectable } from '@nestjs/common';
import type {
  ChatReorderOrder,
  CreateChatOrderRequest,
  CreatedChatOrder,
} from '../types/chat-ordering.types';
import type {
  AssertCustomerCanChatWithShipperRequest,
  CustomerShipperChatPartner,
} from '../types/order-messaging.types';
import { CustomerOrdersService } from './customer-orders.service';
import { OrderRulesService } from './order-rules.service';

/** Orders-owned chat authorization and order actions initiated from chat. */
@Injectable()
export class OrderMessagingService {
  constructor(
    private readonly customerOrders: CustomerOrdersService,
    private readonly orderRules: OrderRulesService,
  ) {}

  assertCustomerCanChatWithShipper(
    request: AssertCustomerCanChatWithShipperRequest,
  ): Promise<void> {
    return this.orderRules.assertCustomerCanChatWithShipper(request);
  }

  listCustomerShipperChatPartners(customerId: string): Promise<CustomerShipperChatPartner[]> {
    return this.orderRules.listCustomerShipperChatPartners(customerId);
  }

  isOrderOpenForShipperMessaging(orderId: string): Promise<boolean> {
    return this.orderRules.isOrderOpenForShipperMessaging(orderId);
  }

  async getRecentOrdersForReorder(customerId: string, limit: number): Promise<ChatReorderOrder[]> {
    const orders = await this.customerOrders.getMinimalOrderHistoryForQuickReorder(
      customerId,
      limit,
    );

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

  async createChatOrder(request: CreateChatOrderRequest): Promise<CreatedChatOrder> {
    const order = await this.customerOrders.createOrder({
      userId: request.customerId,
      restaurantId: request.restaurantId,
      addressId: request.addressId,
      paymentMethod: request.paymentMethod,
      orderDetails: request.items.map((item) => ({
        foodId: item.foodId,
        quantity: String(item.quantity),
        price: '0',
        selectedToppings: [],
      })),
    });

    return {
      orderId: order.id,
      total: Number(order.total),
      status: String(order.status),
    };
  }
}
