import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  NOTIFICATION_REQUESTED_EVENT,
  type NotificationRequestedEvent,
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
import type { DeliveryOrderLifecycleState } from '../types/delivery-shipper-order.types';
import { OrderStateMachine, parseOrderStatus } from './order-core.service';

/** Orders owns lifecycle writes requested by Delivery. */
@Injectable()
export class OrderDeliveryLifecycleCommandService {
  private readonly logger = new Logger(OrderDeliveryLifecycleCommandService.name);
  private readonly stateMachine = new OrderStateMachine();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly eventBus: InProcessEventBus,
    private readonly outboxService: OutboxService,
  ) {}

  async startDelivery(orderId: string): Promise<DeliveryOrderLifecycleState> {
    return this.transition(orderId, OrderStatus.SHIPPER_RECEIVED, OrderStatus.DELIVERING);
  }

  async cancelDelivery(orderId: string): Promise<DeliveryOrderLifecycleState> {
    return this.transition(orderId, OrderStatus.DELIVERING, OrderStatus.CANCELED);
  }

  /** Cancels only a confirmed Order that still has no Delivery-owned ShippingDetail. */
  async cancelUnassigned(orderId: string): Promise<DeliveryOrderLifecycleState> {
    const result = await this.orderRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Order);
      const order = await repository.findOne({
        where: { id: orderId },
        relations: ['shippingDetail', 'user'],
        lock: { mode: 'pessimistic_write' },
      });

      if (!order) return { order: null, changed: false, eventId: undefined };

      const current = parseOrderStatus(order.status);
      if (current !== OrderStatus.CONFIRMED || order.shippingDetail) {
        return { order, changed: false, eventId: undefined };
      }

      order.status = this.stateMachine.cancel(order.status);
      const savedOrder = await repository.save(order);
      const event = await this.outboxService.enqueue(manager, {
        eventType: ORDER_STATUS_CHANGED_EVENT,
        aggregateType: 'Order',
        aggregateId: savedOrder.id,
        idempotencyKey: `Order:${savedOrder.id}:status:${OrderStatus.CONFIRMED}->${savedOrder.status}`,
        payload: this.statusChangedPayload(savedOrder, OrderStatus.CONFIRMED),
      });
      return { order: savedOrder, changed: true, eventId: event.id };
    });

    if (!result.order) {
      return { orderId, status: 'not_found' };
    }

    if (result.changed) {
      await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: result.order });
      if (result.eventId) {
        try {
          await this.outboxService.dispatchAfterCommit(result.eventId);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Order ${orderId} canceled; status event queued for retry: ${message}`);
        }
      }

      if (result.order.user?.id) {
        await this.eventBus.publish<NotificationRequestedEvent>(NOTIFICATION_REQUESTED_EVENT, {
          idempotencyKey: `Order:${result.order.id}:canceled`,
          recipientUserId: result.order.user.id,
          description: 'Đơn hàng đã bị hủy',
          content: `Đơn hàng #${result.order.id} đã bị hủy do không tìm thấy tài xế trong khu vực`,
          type: 'order',
        });
      }
    }

    return { orderId: result.order.id, status: result.order.status };
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

  private async transition(
    orderId: string,
    expected: OrderStatus,
    target: OrderStatus,
  ): Promise<DeliveryOrderLifecycleState> {
    const result = await this.orderRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Order);
      const order = await repository.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');

      const current = parseOrderStatus(order.status);
      if (current === target) return { order, changed: false };
      if (current !== expected) {
        throw new BadRequestException(
          target === OrderStatus.DELIVERING
            ? 'Order must be received by shipper before delivery starts'
            : 'Order is not currently being delivered',
        );
      }

      order.status =
        target === OrderStatus.DELIVERING
          ? this.stateMachine.startDelivery(order.status)
          : this.stateMachine.cancel(order.status);
      return { order: await repository.save(order), changed: true };
    });

    if (result.changed) {
      await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: result.order });
    }
    return { orderId: result.order.id, status: result.order.status };
  }
}
