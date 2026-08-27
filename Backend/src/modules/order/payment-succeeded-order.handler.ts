import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  PAYMENT_SUCCEEDED_EVENT,
  PaymentSucceededEvent,
} from 'src/common/events/payment-succeeded.event';
import { OrderCommandService } from './order-command.service';

@Injectable()
export class PaymentSucceededOrderHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly orderCommandService: OrderCommandService,
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
    await this.orderCommandService.markPaid(event.orderId);
  }
}
