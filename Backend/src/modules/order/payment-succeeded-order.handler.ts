import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  PAYMENT_SUCCEEDED_EVENT,
  PaymentSucceededEvent,
} from 'src/common/events/payment-succeeded.event';
import { pubSub } from 'src/pubsub';
import { OrderService } from './order.service';

@Injectable()
export class PaymentSucceededOrderHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly orderService: OrderService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe<PaymentSucceededEvent>(
      PAYMENT_SUCCEEDED_EVENT,
      (event) => this.handle(event),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(event: PaymentSucceededEvent): Promise<void> {
    const updatedOrder = await this.orderService.updateOrderStatus(event.orderId, 'pending');

    await pubSub.publish('orderCreated', { orderCreated: updatedOrder });
  }
}
