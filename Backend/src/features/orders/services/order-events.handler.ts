import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  DELIVERY_COMPLETED_EVENT,
  DeliveryCompletedEvent,
} from 'src/common/events/delivery-completed.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  PAYMENT_SUCCEEDED_EVENT,
  PaymentSucceededEvent,
} from 'src/common/events/payment-succeeded.event';
import { AdminOrdersService } from 'src/features/orders/services/admin-orders.service';

@Injectable()
export class DeliveryCompletedOrderHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly adminOrdersService: AdminOrdersService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe<DeliveryCompletedEvent>(
      DELIVERY_COMPLETED_EVENT,
      (event) => this.handle(event),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(event: DeliveryCompletedEvent): Promise<void> {
    await this.adminOrdersService.completeFromDelivery(event.orderId);
  }
}

@Injectable()
export class PaymentSucceededOrderHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly adminOrdersService: AdminOrdersService,
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
    await this.adminOrdersService.markPaid(event.orderId);
  }
}
