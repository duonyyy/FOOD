import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  NOTIFICATION_REQUESTED_EVENT,
  NotificationRequestedEvent,
} from 'src/common/events/notification-requested.event';
import {
  ORDER_STATUS_CHANGED_EVENT,
  type OrderStatusChangedEvent,
} from 'src/common/events/order-events';
import { OutboxService } from 'src/common/events/outbox.service';
import { Order } from 'src/entities/order.entity';
import { pubSub } from 'src/pubsub';
import { OrderStatus } from 'src/shared/types/enums/order-status.enum';
import { Repository } from 'typeorm';
import {
  InvalidOrderStatusError,
  InvalidOrderTransitionError,
  OrderCoreService,
  OrderStateMachine,
  parseOrderStatus,
} from './order-core.service';

@Injectable()
export class MerchantOrdersService {
  private readonly logger = new Logger(MerchantOrdersService.name);
  private readonly stateMachine = new OrderStateMachine();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderCoreService: OrderCoreService,
    private readonly eventBus: InProcessEventBus,
    private readonly outboxService: OutboxService,
  ) {}

  /**
   * Get paginated orders belonging to a restaurant
   */
  async getOrdersByRestaurant(
    restaurantId: string,
    page: number = 1,
    pageSize: number = 10,
    status?: string,
  ) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.restaurant', 'restaurant')
      .leftJoinAndSelect('order.address', 'address')
      .leftJoinAndSelect('order.orderDetails', 'orderDetails')
      .leftJoinAndSelect('orderDetails.food', 'food')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoinAndSelect('order.shippingDetail', 'shippingDetail')
      .leftJoinAndSelect('shippingDetail.shipper', 'shipper')
      .where('order.restaurant.id = :restaurantId', { restaurantId })
      .orderBy('order.createdAt', 'DESC');

    if (status) query.andWhere('order.status = :status', { status });

    const [items, totalItems] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: items.map((order) => this.orderCoreService.cleanSensitiveData(order)),
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  /**
   * Confirm order and trigger shipper dispatching
   */
  async confirmOrder(orderId: string, restaurantOwnerId: string): Promise<Order> {
    this.logger.log(`Confirming order ${orderId} by restaurant owner ${restaurantOwnerId}`);
    const order = await this.orderCoreService.getOrderById(orderId);
    const previousStatus = parseOrderStatus(order.status);

    try {
      order.status = this.stateMachine.confirm(order.status);
    } catch (error) {
      if (
        error instanceof InvalidOrderStatusError ||
        error instanceof InvalidOrderTransitionError
      ) {
        throw new BadRequestException('Order is not in a confirmable state');
      }
      throw error;
    }

    const confirmedOrder = await this.saveWithStatusEvent(order, previousStatus);

    return confirmedOrder;
  }

  /**
   * Update order status with state machine transition validation
   */
  async updateOrderStatus(id: string, status: string): Promise<Order> {
    const order = await this.orderCoreService.getOrderById(id);
    const previousStatus = parseOrderStatus(order.status);
    let nextStatus: OrderStatus;

    try {
      nextStatus = this.stateMachine.transition(order.status, status);
    } catch (error) {
      if (
        error instanceof InvalidOrderStatusError ||
        error instanceof InvalidOrderTransitionError
      ) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }

    order.status = nextStatus;
    const updatedOrder = await this.saveWithStatusEvent(order, previousStatus);

    await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: updatedOrder });
    this.logger.log(`Order ${id} status updated to ${nextStatus}`);

    if (order.user?.id) {
      await this.eventBus.publish<NotificationRequestedEvent>(NOTIFICATION_REQUESTED_EVENT, {
        idempotencyKey: `Order:${order.id}:status:${nextStatus}`,
        recipientUserId: order.user.id,
        description: 'Cập nhật trạng thái đơn hàng',
        content: `Đơn hàng của bạn đã chuyển sang trạng thái: ${nextStatus}`,
        type: 'order',
      });
    }

    return updatedOrder;
  }

  rejectOrder(orderId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, OrderStatus.CANCELED);
  }

  cancelOrder(orderId: string): Promise<Order> {
    return this.updateOrderStatus(orderId, OrderStatus.CANCELED);
  }

  private async saveWithStatusEvent(order: Order, previousStatus: OrderStatus): Promise<Order> {
    const result = await this.orderRepository.manager.transaction(async (manager) => {
      const savedOrder = await manager.getRepository(Order).save(order);
      const event = await this.outboxService.enqueue(manager, {
        eventType: ORDER_STATUS_CHANGED_EVENT,
        aggregateType: 'Order',
        aggregateId: savedOrder.id,
        idempotencyKey: `Order:${savedOrder.id}:status:${previousStatus}->${savedOrder.status}`,
        payload: this.statusChangedPayload(savedOrder, previousStatus),
      });
      return { savedOrder, eventId: event.id };
    });

    try {
      await this.outboxService.dispatchAfterCommit(result.eventId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Order ${order.id} committed; status event queued for retry: ${message}`);
    }

    return result.savedOrder;
  }

  private statusChangedPayload(
    order: Order,
    previousStatus: OrderStatus,
  ): OrderStatusChangedEvent & Record<string, unknown> {
    return {
      orderId: order.id,
      customerId: order.user?.id,
      previousStatus,
      status: order.status,
      hasShippingDetail: Boolean(order.shippingDetail),
      occurredAt: new Date().toISOString(),
    };
  }
}
