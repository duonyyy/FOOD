import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  DELIVERY_ASSIGNMENT_CLAIMED_EVENT,
  DELIVERY_ASSIGNMENT_REJECTED_EVENT,
  type DeliveryAssignmentClaimedEvent,
  type DeliveryAssignmentRejectedEvent,
} from 'src/common/events/delivery-assignment.events';
import {
  DELIVERY_COMPLETED_EVENT,
  type DeliveryCompletedEvent,
} from 'src/common/events/delivery-completed.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  ORDER_STATUS_CHANGED_EVENT,
  type OrderStatusChangedEvent,
} from 'src/common/events/order-events';
import { DeliveryDispatchService } from '../services/delivery-dispatch.service';
import { DeliveryTripService } from '../services/delivery-trip.service';

/** Keeps Delivery assignment state aligned with Orders without a module dependency from Orders. */
@Injectable()
export class DeliveryEventsHandler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeliveryEventsHandler.name);
  private readonly unsubscribers: Array<() => void> = [];

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly deliveryDispatchService: DeliveryDispatchService,
    private readonly deliveryTripService: DeliveryTripService,
  ) {}

  onModuleInit(): void {
    if (this.unsubscribers.length > 0) return;
    this.unsubscribers.push(
      this.eventBus.subscribe<OrderStatusChangedEvent>(ORDER_STATUS_CHANGED_EVENT, (event) =>
        this.handleOrderStatus(event),
      ),
      this.eventBus.subscribe<DeliveryAssignmentClaimedEvent>(
        DELIVERY_ASSIGNMENT_CLAIMED_EVENT,
        (event) => this.deliveryTripService.activate(event),
      ),
      this.eventBus.subscribe<DeliveryAssignmentRejectedEvent>(
        DELIVERY_ASSIGNMENT_REJECTED_EVENT,
        (event) => this.deliveryTripService.cancelReservation(event),
      ),
      this.eventBus.subscribe<DeliveryCompletedEvent>(DELIVERY_COMPLETED_EVENT, async (event) => {
        await this.deliveryTripService.project(event);
      }),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
  }

  private async handleOrderStatus(event: OrderStatusChangedEvent): Promise<void> {
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
