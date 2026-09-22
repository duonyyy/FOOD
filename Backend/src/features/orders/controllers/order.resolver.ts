import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Context, Resolver, Subscription } from '@nestjs/graphql';
import { Order } from 'src/entities/order.entity';
import {
  requireGraphqlSubscriptionActorId,
  WebSocketAuthGuard,
  type GraphqlSubscriptionContext,
} from 'src/features/auth/public-api';
import { RestaurantReaderService } from 'src/features/restaurants/public-api';
import { pubSub } from 'src/pubsub';

interface OrderCreatedPayload {
  orderCreated: Order;
}
interface OrderStatusUpdatedPayload {
  orderStatusUpdated: Order;
}
/** GraphQL transport for customer and merchant Order events. */
@Resolver(() => Order)
export class OrderResolver {
  constructor(private readonly restaurantReader: RestaurantReaderService) {}

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
}
