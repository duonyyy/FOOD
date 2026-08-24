import { Injectable } from '@nestjs/common';
import { pubSub } from 'src/pubsub';

@Injectable()
export class OrderCreatedPublisher {
  async publish(order: any): Promise<void> {
    await pubSub.publish('orderCreated', { orderCreated: order });
  }
}
