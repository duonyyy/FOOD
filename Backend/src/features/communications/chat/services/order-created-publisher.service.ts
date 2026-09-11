import { Injectable } from '@nestjs/common';
import { Order } from 'src/entities/order.entity';
import { pubSub } from 'src/pubsub';

@Injectable()
export class OrderCreatedPublisher {
  async publish(order: Order): Promise<void> {
    await pubSub.publish('orderCreated', { orderCreated: order });
  }
}
