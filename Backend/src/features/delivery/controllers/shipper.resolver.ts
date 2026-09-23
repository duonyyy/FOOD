import { ForbiddenException, Logger, UseGuards } from '@nestjs/common';
import { Args, Context, ID, Resolver, Subscription } from '@nestjs/graphql';
import {
  requireGraphqlSubscriptionActorId,
  WebSocketAuthGuard,
  type GraphqlSubscriptionContext,
} from 'src/features/auth/public-api';
import {
  orderSubscriptionGraphqlType,
  type ShipperOrderSubscriptionPayload,
} from 'src/features/orders/public-api';
import { pubSub } from 'src/pubsub';
import { ShipperLocation } from '../dto/shipper-location.type';
import { ActiveShipperTrackerService } from '../services/dispatch/active-shipper-tracker.service';
import { DeliverySubscriptionAccessService } from '../services/subscription/delivery-subscription-access.service';

interface ShipperLocationPayload {
  shipperLocationUpdated: ShipperLocation;
}

@Resolver()
export class ShipperResolver {
  private readonly logger = new Logger(ShipperResolver.name);

  constructor(
    private readonly deliverySubscriptionAccessService: DeliverySubscriptionAccessService,
    private readonly activeShipperTracker: ActiveShipperTrackerService,
  ) {}

  @Subscription(orderSubscriptionGraphqlType, {
    filter: (
      payload: ShipperOrderSubscriptionPayload,
      variables: { shipperId: string },
      context: GraphqlSubscriptionContext,
    ) => {
      const actorId = requireGraphqlSubscriptionActorId(context);
      return (
        variables.shipperId === actorId &&
        payload.orderConfirmedForShippers.status === 'confirmed' &&
        !payload.orderConfirmedForShippers.shippingDetail &&
        payload.targetShipperId === actorId
      );
    },
    resolve: (payload: ShipperOrderSubscriptionPayload) => {
      const order = payload.orderConfirmedForShippers;
      const shippingFee = order.shippingFee || 0;
      const shipperEarnings =
        order.shipperEarnings || Math.round(shippingFee * (order.shipperCommissionRate || 0.8));

      return {
        ...order,
        shipperEarnings,
        deliveryMetadata: {
          distanceKm: order.deliveryDistance || payload.distanceKm || 0,
          priorityScore: payload.priorityScore,
          assignedAt: new Date(),
          shippingInfo: {
            totalDistance: order.deliveryDistance || payload.distanceKm || 0,
            shippingFee,
            shipperEarnings,
            platformFee: shippingFee - shipperEarnings,
            shipperCommissionRate: order.shipperCommissionRate || 0.8,
            estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
          },
        },
      };
    },
  })
  @UseGuards(WebSocketAuthGuard)
  async orderConfirmedForShippers(
    @Args('shipperId') shipperId: string,
    @Args('latitude') latitude: string,
    @Args('longitude') longitude: string,
    @Args('maxDistance', { nullable: true, defaultValue: 20 }) maxDistance: number,
    @Context() context: GraphqlSubscriptionContext,
  ) {
    if (!shipperId || !latitude || !longitude) {
      throw new Error('Shipper ID, latitude and longitude are required');
    }
    if (shipperId !== requireGraphqlSubscriptionActorId(context)) {
      throw new ForbiddenException('Shipper order subscription access denied');
    }

    const result = await this.activeShipperTracker.addShipper(
      shipperId,
      Number(latitude),
      Number(longitude),
      maxDistance,
    );
    if (!result.success) {
      this.logger.warn(`Shipper ${shipperId} subscription rejected: ${result.message}`);
      throw new Error(`Subscription rejected: ${result.message}`);
    }

    return pubSub.asyncIterableIterator('orderConfirmedForShippers');
  }

  @Subscription(() => ShipperLocation)
  @UseGuards(WebSocketAuthGuard)
  async shipperLocationUpdated(
    @Args('shipperId', { type: () => ID }) shipperId: string,
    @Context() context: GraphqlSubscriptionContext,
  ): Promise<AsyncIterableIterator<ShipperLocationPayload>> {
    const actorId = requireGraphqlSubscriptionActorId(context);
    if (
      !(await this.deliverySubscriptionAccessService.canAccessShipperLocation(actorId, shipperId))
    ) {
      throw new ForbiddenException('Delivery location access denied');
    }

    return this.filterAuthorizedLocationEvents(
      pubSub.asyncIterableIterator<ShipperLocationPayload>('shipperLocationUpdated'),
      actorId,
      shipperId,
    );
  }

  private async *filterAuthorizedLocationEvents(
    events: AsyncIterable<ShipperLocationPayload>,
    actorId: string,
    shipperId: string,
  ): AsyncGenerator<ShipperLocationPayload> {
    for await (const payload of events) {
      const isAuthorized = await this.deliverySubscriptionAccessService.canAccessShipperLocation(
        actorId,
        shipperId,
      );
      if (isAuthorized && payload.shipperLocationUpdated.shipperId === shipperId) {
        yield payload;
      }
    }
  }
}
