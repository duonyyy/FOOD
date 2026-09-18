import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { pubSub } from 'src/pubsub';
import { OrderStatus } from 'src/shared/types/enums/order-status.enum';
import { Repository } from 'typeorm';
import type { DeliveryOrderLifecycleState } from '../types/delivery-shipper-order.types';
import { OrderStateMachine, parseOrderStatus } from './order-core.service';

/** Orders owns lifecycle writes requested by Delivery. */
@Injectable()
export class OrderDeliveryLifecycleCommandService {
  private readonly stateMachine = new OrderStateMachine();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async startDelivery(orderId: string): Promise<DeliveryOrderLifecycleState> {
    return this.transition(orderId, OrderStatus.SHIPPER_RECEIVED, OrderStatus.DELIVERING);
  }

  async cancelDelivery(orderId: string): Promise<DeliveryOrderLifecycleState> {
    return this.transition(orderId, OrderStatus.DELIVERING, OrderStatus.CANCELED);
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
