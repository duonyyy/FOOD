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
import {
  SHIPPER_OFFER_REQUESTED_EVENT,
  type ShipperOfferRequestedEvent,
} from 'src/common/events/shipper-offer-requested.event';
import { AdminOrdersService } from 'src/features/orders/services/admin-orders.service';
import { pubSub } from 'src/pubsub';
import { OrderCoreService } from './order-core.service';

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
    await this.adminOrdersService.completeFromDelivery(event.orderId, event.earnings);
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

/** Orders rehydrates its own entity before publishing the shipper GraphQL offer. */
@Injectable()
export class ShipperOfferRequestedOrderHandler implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(
    private readonly eventBus: InProcessEventBus,
    private readonly orderCoreService: OrderCoreService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.eventBus.subscribe<ShipperOfferRequestedEvent>(
      SHIPPER_OFFER_REQUESTED_EVENT,
      (event) => this.handle(event),
    );
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(event: ShipperOfferRequestedEvent): Promise<void> {
    const order = await this.orderCoreService.getOrderById(event.orderId);
    if (order.status !== 'confirmed' || order.shippingDetail) {
      return;
    }

    await pubSub.publish('orderConfirmedForShippers', {
      orderConfirmedForShippers: order,
      targetShipperId: event.targetShipperId,
      distanceKm: event.distanceKm,
      priorityScore: event.priorityScore,
      earningsInfo: {
        shippingFee: event.shippingFee,
        shipperEarnings: event.shipperEarnings,
        platformFee: event.shippingFee - event.shipperEarnings,
        netProfit: Math.max(0, event.shipperEarnings - event.distanceKm * 3000),
        earningsPerKm:
          event.distanceKm > 0 ? Math.round(event.shipperEarnings / event.distanceKm) : 0,
      },
    });
  }
}
