import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DELIVERY_COMPLETED_EVENT, DeliveryCompletedEvent } from 'src/common/events/delivery-completed.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { OrderCommandService } from './order-command.service';

@Injectable()
export class DeliveryCompletedOrderHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly orderCommandService: OrderCommandService,
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
    await this.orderCommandService.completeFromDelivery(event.orderId);
  }
}
