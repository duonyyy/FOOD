import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  NOTIFICATION_REQUESTED_EVENT,
  NotificationRequestedEvent,
} from 'src/common/events/notification-requested.event';
import { Order } from 'src/entities/order.entity';
import { DeliveryAssignmentScheduler } from 'src/features/delivery/public-api';
import {
  PAYMENT_CHECKOUT_COMMANDS,
  type PaymentCheckoutCommandsPort,
} from 'src/features/payments/public-api';
import { pubSub } from 'src/pubsub';
import { LessThan, Repository } from 'typeorm';
import {
  InvalidOrderStatusError,
  InvalidOrderTransitionError,
  OrderCoreService,
  OrderStateMachine,
  OrderStatus,
  parseOrderStatus,
} from './order-core.service';

@Injectable()
export class AdminOrdersService {
  private readonly logger = new Logger(AdminOrdersService.name);
  private readonly stateMachine = new OrderStateMachine();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderCoreService: OrderCoreService,
    private readonly pendingAssignmentService: DeliveryAssignmentScheduler,
    private readonly eventBus: InProcessEventBus,
    @Inject(PAYMENT_CHECKOUT_COMMANDS)
    private readonly paymentCheckoutCommands: PaymentCheckoutCommandsPort,
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

    return orders.map((order) => this.orderCoreService.cleanSensitiveData(order));
  }

  /**
   * Admin status update with state validation
   */
  async adminUpdateOrderStatus(id: string, status: string): Promise<Order> {
    const order = await this.orderCoreService.getOrderById(id);
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
  async completeFromDelivery(orderId: string): Promise<Order> {
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

  /**
   * Auto-cancel confirmed orders that failed shipper assignment after timeout
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCancelUnassignedOrders() {
    const timeoutMinutes = 30;
    const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    this.logger.log(`🔍 Checking for pending assignments older than ${timeoutMinutes} minutes...`);

    const expiredAssignments =
      await this.pendingAssignmentService.getExpiredAssignments(timeoutDate);

    if (expiredAssignments.length > 0) {
      this.logger.log(`🚫 Found ${expiredAssignments.length} expired assignments to cancel`);
    }

    for (const assignment of expiredAssignments) {
      try {
        const order = await this.orderRepository.findOne({
          where: { id: assignment.order.id },
          relations: ['shippingDetail', 'restaurant', 'user'],
        });

        if (!order) {
          await this.pendingAssignmentService.removePendingAssignmentById(assignment.id);
          continue;
        }

        if (order.status !== 'confirmed') {
          continue;
        }

        if (order.shippingDetail) {
          await this.pendingAssignmentService.removePendingAssignment(order.id);
          continue;
        }

        order.status = this.stateMachine.cancel(order.status);
        await this.orderRepository.save(order);
        await this.pendingAssignmentService.removePendingAssignmentById(assignment.id);

        await pubSub.publish('orderStatusUpdated', {
          orderStatusUpdated: order,
        });

        if (order.user?.id) {
          await this.eventBus.publish<NotificationRequestedEvent>(NOTIFICATION_REQUESTED_EVENT, {
            idempotencyKey: `Order:${order.id}:canceled`,
            recipientUserId: order.user.id,
            description: 'Đơn hàng đã bị hủy',
            content: `Đơn hàng #${order.id} đã bị hủy do không tìm thấy tài xế trong khu vực`,
            type: 'order',
          });
        }
      } catch (error) {
        this.logger.error(`❌ Failed to auto-cancel order ${assignment.order.id}:`, error);
      }
    }
  }
}
