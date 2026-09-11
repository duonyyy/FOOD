import { ForbiddenException, Inject, Logger, UseGuards } from '@nestjs/common';
import { Args, Context, Resolver, Subscription } from '@nestjs/graphql';
import { Order } from 'src/entities/order.entity';
import {
  requireGraphqlSubscriptionActorId,
  WebSocketAuthGuard,
  type GraphqlSubscriptionContext,
} from 'src/features/auth/public-api';
import { ActiveShipperTrackerService } from 'src/features/delivery/public-api';
import { RESTAURANT_READER, type RestaurantReaderPort } from 'src/features/restaurants/public-api';
import { pubSub } from 'src/pubsub';

interface OrderCreatedPayload {
  orderCreated: Order;
}
interface OrderStatusUpdatedPayload {
  orderStatusUpdated: Order;
}
interface ShipperOrderPayload {
  orderConfirmedForShippers: Order;
  targetShipperId: string;
  distanceKm?: number;
  priorityScore?: number;
}

/** GraphQL transport for Order events; shipper runtime policy is Delivery-owned. */
@Resolver(() => Order)
export class OrderResolver {
  private readonly logger = new Logger(OrderResolver.name);

  constructor(
    private readonly activeShipperTracker: ActiveShipperTrackerService,
    @Inject(RESTAURANT_READER)
    private readonly restaurantReader: RestaurantReaderPort,
  ) {}

  @Subscription(() => Order, {
    filter: (
      payload: OrderCreatedPayload,
      variables: { restaurantId: string },
      context: GraphqlSubscriptionContext,
    ) => {
      requireGraphqlSubscriptionActorId(context);
      return (
        payload.orderCreated.restaurant?.id === variables.restaurantId &&
        payload.orderCreated.status === 'pending'
      );
    },
    resolve: (payload: OrderCreatedPayload) => payload.orderCreated,
  })
  @UseGuards(WebSocketAuthGuard)
  async orderCreated(
    @Args('restaurantId') restaurantId: string,
    @Context() context: GraphqlSubscriptionContext,
  ) {
    if (!restaurantId) throw new Error('restaurantId is required for orderCreated subscription');

    const actorId = requireGraphqlSubscriptionActorId(context);
    const restaurant = await this.restaurantReader.findActiveRestaurant(restaurantId);
    if (!restaurant || restaurant.ownerId !== actorId) {
      throw new ForbiddenException('Restaurant order subscription access denied');
    }

    return pubSub.asyncIterableIterator('orderCreated');
  }

  @Subscription(() => Order, {
    filter: (
      payload: OrderStatusUpdatedPayload,
      variables: { userId: string },
      context: GraphqlSubscriptionContext,
    ) => {
      const actorId = requireGraphqlSubscriptionActorId(context);
      return (
        variables.userId === actorId &&
        payload.orderStatusUpdated.user?.id === actorId &&
        ['confirmed', 'delivering', 'shipper_received', 'completed', 'canceled'].includes(
          payload.orderStatusUpdated.status,
        )
      );
    },
    resolve: (payload: OrderStatusUpdatedPayload) => payload.orderStatusUpdated,
  })
  @UseGuards(WebSocketAuthGuard)
  orderStatusUpdated(
    @Args('userId') userId: string,
    @Context() context: GraphqlSubscriptionContext,
  ) {
    if (!userId) throw new Error('userId is required for orderStatusUpdated subscription');
    if (userId !== requireGraphqlSubscriptionActorId(context)) {
      throw new ForbiddenException('Order status subscription access denied');
    }

    return pubSub.asyncIterableIterator('orderStatusUpdated');
  }

  @Subscription(() => Order, {
    filter: (
      payload: ShipperOrderPayload,
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
    resolve: (payload: ShipperOrderPayload) => {
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
}
