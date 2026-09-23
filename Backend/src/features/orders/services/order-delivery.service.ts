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
import { In, Repository } from 'typeorm';
import type { DeliveryCompletionOrder } from '../types/delivery-completion.types';
import type { DeliveryDispatchCandidate } from '../types/delivery-dispatch.types';
import type {
  DeliveryOrderLifecycleState,
  ShipperOrderView,
} from '../types/delivery-shipper-order.types';
import { OrderStateMachine, parseOrderStatus } from './order-rules.service';

export type DeliveryAssignmentClaimResult =
  | { accepted: true; orderStatus: OrderStatus.SHIPPER_RECEIVED }
  | { accepted: false; orderStatus: string };

/** Orders-owned data and lifecycle operations requested by Delivery. */
@Injectable()
export class OrderDeliveryService {
  private readonly logger = new Logger(OrderDeliveryService.name);
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

  async claim(orderId: string): Promise<DeliveryAssignmentClaimResult> {
    const result = await this.orderRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Order);
      const order = await repository.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) return { order: null, changed: false };

      const currentStatus = parseOrderStatus(order.status);
      if (currentStatus !== OrderStatus.CONFIRMED) {
        return { order, changed: false };
      }

      order.status = this.stateMachine.markShipperReceived(order.status);
      return { order: await repository.save(order), changed: true };
    });

    if (!result.order || parseOrderStatus(result.order.status) !== OrderStatus.SHIPPER_RECEIVED) {
      return { accepted: false, orderStatus: result.order?.status ?? 'not_found' };
    }

    if (result.changed) {
      await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: result.order });
    }
    return { accepted: true, orderStatus: OrderStatus.SHIPPER_RECEIVED };
  }

  async findForCompletion(orderId: string): Promise<DeliveryCompletionOrder | null> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user'],
    });
    if (!order) return null;

    return {
      orderId: order.id,
      customerId: order.user?.id ?? null,
      status: order.status,
      shippingFee: order.shippingFee ?? null,
      deliveryDistance: order.deliveryDistance ?? null,
      total: order.total ?? null,
      estimatedDeliveryTime: order.estimatedDeliveryTime ?? null,
      shipperEarnings: order.shipperEarnings ?? null,
    };
  }

  async findConfirmedDispatchCandidate(orderId: string): Promise<DeliveryDispatchCandidate | null> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, status: OrderStatus.CONFIRMED },
      relations: ['restaurant'],
    });
    return order ? this.toDispatchCandidate(order) : null;
  }

  async listConfirmedOrderIds(limit = 100): Promise<string[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const orders = await this.orderRepository.find({
      select: { id: true },
      where: { status: OrderStatus.CONFIRMED },
      order: { createdAt: 'ASC' },
      take: safeLimit,
    });
    return orders.map((order) => order.id);
  }

  async getShipperOrder(orderId: string): Promise<ShipperOrderView> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'restaurant', 'address', 'orderDetails', 'orderDetails.food'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toShipperOrderView(order);
  }

  async getShipperOrders(orderIds: readonly string[]): Promise<Map<string, ShipperOrderView>> {
    if (orderIds.length === 0) return new Map();
    const orders = await this.orderRepository.find({
      where: { id: In([...orderIds]) },
      relations: ['user', 'restaurant', 'address', 'orderDetails', 'orderDetails.food'],
    });
    return new Map(orders.map((order) => [order.id, this.toShipperOrderView(order)]));
  }

  async assertCustomerCanTrackOrder(orderId: string, customerId: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, user: { id: customerId } },
    });
    if (!order) throw new NotFoundException('Delivery tracking not found');
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

  private toDispatchCandidate(order: Order): DeliveryDispatchCandidate {
    const latitude = order.restaurant?.latitude;
    const longitude = order.restaurant?.longitude;
    return {
      orderId: order.id,
      restaurantLocation:
        latitude != null && longitude != null
          ? { latitude: Number(latitude), longitude: Number(longitude) }
          : null,
      shippingFee: order.shippingFee ?? null,
      shipperEarnings: order.shipperEarnings ?? null,
      deliveryDistance: order.deliveryDistance ?? null,
      shipperCommissionRate: order.shipperCommissionRate ?? null,
      estimatedDeliveryTime: order.estimatedDeliveryTime ?? null,
    };
  }

  private toShipperOrderView(order: Order): ShipperOrderView {
    return {
      id: order.id,
      status: order.status,
      total: order.total ?? null,
      note: order.note ?? null,
      user: order.user ? { id: order.user.id, name: order.user.name ?? null } : null,
      restaurant: order.restaurant
        ? { id: order.restaurant.id, name: order.restaurant.name ?? null }
        : null,
      address: order.address
        ? {
            street: order.address.street ?? null,
            ward: order.address.ward ?? null,
            district: order.address.district ?? null,
            city: order.address.city ?? null,
          }
        : null,
      orderDetails: (order.orderDetails ?? []).map((detail) => ({
        id: detail.id,
        quantity: detail.quantity ?? null,
        price: detail.price ?? null,
        food: detail.food ? { id: detail.food.id, name: detail.food.name ?? null } : null,
      })),
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
