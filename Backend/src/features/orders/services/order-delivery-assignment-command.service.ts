import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { pubSub } from 'src/pubsub';
import { OrderStatus } from 'src/shared/types/enums/order-status.enum';
import { Repository } from 'typeorm';
import { OrderStateMachine, parseOrderStatus } from './order-core.service';

export type DeliveryAssignmentClaimResult =
  | { accepted: true; orderStatus: OrderStatus.SHIPPER_RECEIVED }
  | { accepted: false; orderStatus: string };

/** Orders-owned command for the confirmed -> shipper_received transition. */
@Injectable()
export class OrderDeliveryAssignmentCommandService {
  private readonly stateMachine = new OrderStateMachine();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async claim(orderId: string): Promise<DeliveryAssignmentClaimResult> {
    const result = await this.orderRepository.manager.transaction(async (manager) => {
      const repository = manager.getRepository(Order);
      const order = await repository.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        return { order: null, changed: false };
      }
      const currentStatus = parseOrderStatus(order.status);
      if (currentStatus === OrderStatus.SHIPPER_RECEIVED) {
        return { order, changed: false };
      }
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
}
