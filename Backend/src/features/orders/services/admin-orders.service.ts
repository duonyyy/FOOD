import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
import { PaymentService } from 'src/features/payments/public-api';
import { pubSub } from 'src/pubsub';
import { OrderStatus } from 'src/shared/types/enums/order-status.enum';
import { LessThan, Repository } from 'typeorm';
import {
  InvalidOrderStatusError,
  InvalidOrderTransitionError,
  OrderStateMachine,
  parseOrderStatus,
} from './order-rules.service';
import { PublicOrdersService } from './public-orders.service';

@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);
  private readonly stateMachine = new OrderStateMachine();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly publicOrders: PublicOrdersService,
    private readonly eventBus: InProcessEventBus,
    private readonly outboxService: OutboxService,
    private readonly paymentCheckoutCommands: PaymentService,
  ) {}

  /**
   * Get all orders in system (Admin view)
   */
  async getAllOrders() {
    const orders = await this.orderRepository.find({
      relations: [
        'user',
        'restaurant',
        'orderDetails',
        'orderDetails.food',
        'shippingDetail',
        'shippingDetail.shipper',
        'promotionCode',
        'address',
      ],
      order: { createdAt: 'DESC' },
    });

    return orders.map((order) => this.publicOrders.cleanSensitiveData(order));
  }

  /**
   * Admin status update with state validation
   */
  async adminUpdateOrderStatus(id: string, status: string): Promise<Order> {
    const order = await this.publicOrders.getOrderById(id);
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
    this.logger.log(`Admin updated order ${id} status to ${nextStatus}`);

    if (order.user?.id) {
      await this.eventBus.publish<NotificationRequestedEvent>(NOTIFICATION_REQUESTED_EVENT, {
        idempotencyKey: `Order:${order.id}:status:${nextStatus}`,
        recipientUserId: order.user.id,
        description: 'Cập nhật trạng thái đơn hàng bởi Admin',
        content: `Đơn hàng của bạn đã chuyển sang trạng thái: ${nextStatus}`,
        type: 'order',
      });
    }

    return updatedOrder;
  }

  /**
   * Mark order completed from delivery handler (operational fulfillment)
   */
  async completeFromDelivery(orderId: string, shipperEarnings?: number): Promise<Order> {
    const result = await this.orderRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Order);
      const order = await repository.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');

      if (parseOrderStatus(order.status) === OrderStatus.COMPLETED) {
        return { order, changed: false };
      }

      try {
        order.status = this.stateMachine.complete(order.status);
      } catch (error) {
        if (
          error instanceof InvalidOrderStatusError ||
          error instanceof InvalidOrderTransitionError
        ) {
          throw new BadRequestException(
            `Cannot complete order ${orderId} from status ${order.status}`,
          );
        }
        throw error;
      }

      if (shipperEarnings != null) {
        order.shipperEarnings = shipperEarnings;
      }

      return { order: await repository.save(order), changed: true };
    });

    if (result.changed) {
      await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: result.order });
    }

    return result.order;
  }

  /**
   * Mark order paid from payment event handler (idempotent)
   */
  async markPaid(orderId: string): Promise<Order> {
    const result = await this.orderRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Order);
      const order = await repository.findOne({
        where: { id: orderId },
        relations: ['user'],
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');

      if (parseOrderStatus(order.status) === OrderStatus.COMPLETED && order.isPaid) {
        return { order, changed: false };
      }

      try {
        if (parseOrderStatus(order.status) !== OrderStatus.COMPLETED) {
          order.status = this.stateMachine.markPaid(order.status);
        }
      } catch (error) {
        if (
          error instanceof InvalidOrderStatusError ||
          error instanceof InvalidOrderTransitionError
        ) {
          throw new BadRequestException(
            `Cannot confirm payment for an order with status ${order.status}`,
          );
        }
        throw error;
      }

      order.isPaid = true;
      order.paymentDate ??= new Date().toISOString();
      return { order: await repository.save(order), changed: true };
    });

    if (result.changed) {
      await pubSub.publish('orderCreated', { orderCreated: result.order });
      await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: result.order });
    }

    return result.order;
  }

  /**
   * Auto-cancel orders stuck in payment processing
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCancelStuckOrders() {
    const timeoutMinutes = 15;
    const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    const stuckOrders = await this.orderRepository.find({
      where: {
        status: 'processing_payment',
        createdAt: LessThan(timeoutDate),
      },
    });

    if (stuckOrders.length) {
      this.logger.log(`Auto-canceling ${stuckOrders.length} stuck orders...`);
    }

    for (const order of stuckOrders) {
      order.status = this.stateMachine.cancel(order.status);
      await this.orderRepository.save(order);

      await this.paymentCheckoutCommands.cancelPendingCheckoutForOrder(order.id);

      this.logger.log(`Order ${order.id} auto-canceled due to payment timeout.`);
    }
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
