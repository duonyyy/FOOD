import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { CustomerOrdersService } from 'src/features/orders/services/customer-orders.service';
import { OrderCoreService } from 'src/features/orders/services/order-core.service';
import { Repository } from 'typeorm';
import {
  type ChatOrderingPort,
  type ChatReorderOrder,
  type CreateChatOrderRequest,
  type CreatedChatOrderSnapshot,
} from '../contracts/chat-ordering.port';
import {
  type OrderAnalyticsPage,
  type OrderAnalyticsReaderPort,
  type OrderAnalyticsSnapshot,
} from '../contracts/order-analytics-reader.port';
import {
  type OrderNotificationReaderPort,
  type OrderNotificationRecipient,
} from '../contracts/order-notification-reader.port';
import {
  type FindOrderReviewEligibilityRequest,
  type OrderReviewEligibilityReaderPort,
  type OrderReviewEligibilitySnapshot,
} from '../contracts/order-review-eligibility-reader.port';
import { CreateOrderDto } from '../dto/create-order.dto';

/** Compatibility adapter: Analytics receives an Ordering snapshot, never persistence. */
@Injectable()
export class OrderAnalyticsReaderAdapter implements OrderAnalyticsReaderPort {
  constructor(private readonly orderCoreService: OrderCoreService) {}

  async findAnalyticsSnapshot(orderId: string): Promise<OrderAnalyticsSnapshot | null> {
    try {
      return await this.orderCoreService.getAnalyticsSnapshot(orderId);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  async listAnalyticsSnapshots(page: number, pageSize: number): Promise<OrderAnalyticsPage> {
    return this.orderCoreService.getAnalyticsSnapshots(page, pageSize);
  }
}

/** Compatibility adapter: Notifications sees an Ordering snapshot, never Order persistence. */
@Injectable()
export class OrderNotificationReaderAdapter implements OrderNotificationReaderPort {
  constructor(private readonly orderCoreService: OrderCoreService) {}

  async findNotificationRecipient(orderId: string): Promise<OrderNotificationRecipient | null> {
    try {
      const order = await this.orderCoreService.getOrderById(orderId);
      if (!order.user?.id) return null;
      return { orderId: order.id, customerId: order.user.id };
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }
}

/** Review eligibility adapter: determines whether customer can review foods and shippers. */
@Injectable()
export class OrderReviewEligibilityService implements OrderReviewEligibilityReaderPort {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findReviewEligibility(
    request: FindOrderReviewEligibilityRequest,
  ): Promise<OrderReviewEligibilitySnapshot | null> {
    const order = await this.orderRepository.findOne({
      where: { id: request.orderId, user: { id: request.customerId } },
      relations: [
        'user',
        'orderDetails',
        'orderDetails.food',
        'shippingDetail',
        'shippingDetail.shipper',
      ],
    });

    if (!order || !order.user) {
      return null;
    }

    return {
      orderId: order.id,
      customerId: order.user.id,
      orderStatus: order.status ?? null,
      foodIds: (order.orderDetails ?? []).map((detail) => detail.food.id),
      shipperId: order.shippingDetail?.shipper?.id ?? null,
    };
  }
}

/** Chat ordering adapter: supports quick reorder and conversational order placement. */
@Injectable()
export class ChatOrderingService implements ChatOrderingPort {
  constructor(private readonly customerOrdersService: CustomerOrdersService) {}

  async getRecentOrdersForReorder(customerId: string, limit: number): Promise<ChatReorderOrder[]> {
    const orders = await this.customerOrdersService.getMinimalOrderHistoryForQuickReorder(
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

  async createOrder(request: CreateChatOrderRequest): Promise<CreatedChatOrderSnapshot> {
    const dto: CreateOrderDto = {
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
    };

    const order = await this.customerOrdersService.createOrder(dto);
    return {
      orderId: order.id,
      total: Number(order.total),
      status: String(order.status),
    };
  }
}
