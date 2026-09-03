import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  DELIVERY_COMPLETED_EVENT,
  type DeliveryCompletedEvent,
} from 'src/common/events/delivery-completed.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { ORDER_CREATED_EVENT, type OrderCreatedEvent } from 'src/common/events/order-events';
import {
  PAYMENT_FAILED_EVENT,
  type PaymentFailedEvent,
} from 'src/common/events/payment-failed.event';
import {
  PAYMENT_SUCCEEDED_EVENT,
  type PaymentSucceededEvent,
} from 'src/common/events/payment-succeeded.event';
import { AnalyticsProjectionService } from './analytics-projection.service';

/** Keeps Analytics eventually consistent; source aggregate transactions are already committed. */
@Injectable()
export class AnalyticsProjectionHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AnalyticsProjectionHandler.name);
  private readonly unsubscriptions: Array<() => void> = [];

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly projection: AnalyticsProjectionService,
  ) {}

  onModuleInit(): void {
    this.unsubscriptions.push(
      this.eventBus.subscribe<OrderCreatedEvent>(ORDER_CREATED_EVENT, (event) =>
        this.run(ORDER_CREATED_EVENT, event.orderId, () =>
          this.projection.projectOrder(event.orderId),
        ),
      ),
      this.eventBus.subscribe<PaymentSucceededEvent>(PAYMENT_SUCCEEDED_EVENT, (event) =>
        this.run(PAYMENT_SUCCEEDED_EVENT, event.orderId, () =>
          this.projection.recordPayment(event.orderId, 'COMPLETED'),
        ),
      ),
      this.eventBus.subscribe<PaymentFailedEvent>(PAYMENT_FAILED_EVENT, (event) =>
        this.run(PAYMENT_FAILED_EVENT, event.orderId, () =>
          this.projection.recordPayment(event.orderId, 'FAILED'),
        ),
      ),
      this.eventBus.subscribe<DeliveryCompletedEvent>(DELIVERY_COMPLETED_EVENT, (event) =>
        this.run(DELIVERY_COMPLETED_EVENT, event.orderId, () =>
          this.projection.recordDeliveryCompleted(
            event.orderId,
            event.shipperId,
            event.completedAt,
          ),
        ),
      ),
    );
  }

  onModuleDestroy(): void {
    this.unsubscriptions.splice(0).forEach((unsubscribe) => unsubscribe());
  }

  private async run(
    eventType: string,
    orderId: string,
    action: () => Promise<boolean>,
  ): Promise<void> {
    try {
      const applied = await action();
      if (!applied)
        this.logger.warn(`analytics_projection_skipped event=${eventType} order=${orderId}`);
    } catch (error) {
      this.logger.error(
        `analytics_projection_failed event=${eventType} order=${orderId}: ${this.errorMessage(error)}`,
      );
      // The event is delivered after the source transaction commits. Never roll it back.
    }
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
