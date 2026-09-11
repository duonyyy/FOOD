import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  NOTIFICATION_REQUESTED_EVENT,
  NotificationRequestedEvent,
} from 'src/common/events/notification-requested.event';
import { Order } from 'src/entities/order.entity';
import { DeliveryAssignmentScheduler } from 'src/features/delivery/public-api';
import { pubSub } from 'src/pubsub';
import { Repository } from 'typeorm';
import {
  InvalidOrderStatusError,
  InvalidOrderTransitionError,
  OrderCoreService,
  OrderStateMachine,
  OrderStatus,
  parseOrderStatus,
} from './order-core.service';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class MerchantOrdersService {
  private readonly logger = new Logger(MerchantOrdersService.name);
  private readonly stateMachine = new OrderStateMachine();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderCoreService: OrderCoreService,
    private readonly pendingAssignmentService: DeliveryAssignmentScheduler,
    private readonly eventBus: InProcessEventBus,
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

    const confirmedOrder = await this.orderRepository.save(order);

    try {
      const pendingAssignment = await this.pendingAssignmentService.addPendingAssignment(
        confirmedOrder.id,
        1,
      );
      this.logger.log(
        `Created pending shipper assignment ${pendingAssignment.id} for order ${orderId}`,
      );
    } catch (error) {
      this.logger.error(`Failed to create pending shipper assignment for order ${orderId}:`, error);
      this.logger.warn(`Order ${orderId} confirmed but shipper assignment failed`);
    }

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
    const updatedOrder = await this.orderRepository.save(order);

    await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: updatedOrder });
    this.logger.log(`Order ${id} status updated to ${nextStatus}`);

    // Manage pending assignments for shipper dispatching
    if (nextStatus === OrderStatus.CONFIRMED && previousStatus !== OrderStatus.CONFIRMED) {
      if (!updatedOrder.shippingDetail) {
        try {
          await this.pendingAssignmentService.addPendingAssignment(id, 1);
          this.logger.log(`Added order ${id} to pending shipper assignments`);
        } catch (error: unknown) {
          this.logger.error(
            `Failed to add order ${id} to pending assignments: ${errorMessage(error)}`,
          );
        }
      }
    }

    if (previousStatus === OrderStatus.CONFIRMED && nextStatus !== OrderStatus.CONFIRMED) {
      try {
        await this.pendingAssignmentService.removePendingAssignment(id);
        this.logger.log(`Removed order ${id} from pending assignments due to status change`);
      } catch (error: unknown) {
        this.logger.error(
          `Failed to remove order ${id} from pending assignments: ${errorMessage(error)}`,
        );
      }
    }

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
}
