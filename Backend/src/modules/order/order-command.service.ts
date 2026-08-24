import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  NOTIFICATION_REQUESTED_EVENT,
  NotificationRequestedEvent,
} from 'src/common/events/notification-requested.event';
import { Order } from 'src/entities/order.entity';
import {
  InvalidOrderStatusError,
  InvalidOrderTransitionError,
  OrderStateMachine,
  OrderStatus,
} from 'src/features/orders/state-machine/order-status';
import { PendingAssignmentService } from 'src/infra/queue/pending-assignment.service';
import { pubSub } from 'src/pubsub';
import { Repository } from 'typeorm';
import { OrderQueryService } from './order-query.service';

@Injectable()
export class OrderCommandService {
  private readonly logger = new Logger(OrderCommandService.name);
  private readonly stateMachine = new OrderStateMachine();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly orderQueryService: OrderQueryService,
    private readonly pendingAssignmentService: PendingAssignmentService,
    private readonly eventBus: InProcessEventBus,
  ) {}

  async updateStatus(id: string, status: string): Promise<Order> {
    const order = await this.orderQueryService.getOrderById(id);
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

    await this.eventBus.publish<NotificationRequestedEvent>(NOTIFICATION_REQUESTED_EVENT, {
      recipientUserId: order.user.id,
      description: 'Cập nhật trạng thái đơn hàng',
      content: `Đơn hàng của bạn đã chuyển sang trạng thái: ${nextStatus}`,
      type: 'order',
    });

    return updatedOrder;
  }

  async confirm(orderId: string, restaurantOwnerId: string): Promise<Order> {
    this.logger.log(`Confirming order ${orderId} for restaurant owner ${restaurantOwnerId}`);
    const order = await this.orderQueryService.getOrderById(orderId);

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

  reject(orderId: string): Promise<Order> {
    return this.updateStatus(orderId, OrderStatus.CANCELED);
  }

  cancel(orderId: string): Promise<Order> {
    return this.updateStatus(orderId, OrderStatus.CANCELED);
  }

  complete(orderId: string): Promise<Order> {
    return this.updateStatus(orderId, OrderStatus.COMPLETED);
  }

  async markPaid(orderId: string): Promise<Order> {
    const order = await this.orderQueryService.getOrderById(orderId);

    try {
      order.status = this.stateMachine.markPaid(order.status);
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
    order.paymentDate = new Date().toISOString();
    const updatedOrder = await this.orderRepository.save(order);

    await pubSub.publish('orderCreated', { orderCreated: updatedOrder });
    await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: updatedOrder });

    return updatedOrder;
  }
}
