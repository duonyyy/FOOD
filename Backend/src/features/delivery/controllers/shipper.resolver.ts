import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Context, ID, Resolver, Subscription } from '@nestjs/graphql';
import {
  requireGraphqlSubscriptionActorId,
  WebSocketAuthGuard,
  type GraphqlSubscriptionContext,
} from 'src/features/auth/public-api';
import { pubSub } from 'src/pubsub';
import { ShipperLocation } from '../dto/shipper-location.type';
import { DeliverySubscriptionAccessService } from '../services/subscription/delivery-subscription-access.service';

interface ShipperLocationPayload {
  shipperLocationUpdated: ShipperLocation;
}

@Resolver()
export class ShipperResolver {
  constructor(
    private readonly deliverySubscriptionAccessService: DeliverySubscriptionAccessService,
  ) {}

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
