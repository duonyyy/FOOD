import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  ORDER_STATUS_CHANGED_EVENT,
  type OrderStatusChangedEvent,
} from 'src/common/events/order-events';
import { DeliveryDispatchService } from './delivery-dispatch.service';

/** Keeps Delivery assignment state aligned with Orders without a module dependency from Orders. */
@Injectable()
export class OrderStatusDeliveryHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrderStatusDeliveryHandler.name);
  private unsubscribe?: () => void;

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly deliveryDispatchService: DeliveryDispatchService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe<OrderStatusChangedEvent>(
      ORDER_STATUS_CHANGED_EVENT,
      (event) => this.handle(event),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(event: OrderStatusChangedEvent): Promise<void> {
    try {
      if (
        event.status === 'confirmed' &&
        event.previousStatus !== 'confirmed' &&
        !event.hasShippingDetail
      ) {
        await this.deliveryDispatchService.addPendingAssignment(event.orderId, 1);
        return;
      }

      if (event.previousStatus === 'confirmed' && event.status !== 'confirmed') {
        await this.deliveryDispatchService.removePendingAssignment(event.orderId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to sync assignment for order ${event.orderId}: ${message}`);
      throw error;
    }
  }
}
