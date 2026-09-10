import { Logger } from '@nestjs/common';
import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { pubSub } from 'src/pubsub';
import { ShipperLocation } from './shipper-location.type';

interface ShipperLocationPayload {
  shipperLocationUpdated: ShipperLocation;
}

interface ShipperLocationVariables {
  shipperId: string;
}

@Resolver()
export class ShipperResolver {
  private readonly logger = new Logger(ShipperResolver.name);

  @Subscription(() => ShipperLocation, {
    filter: (payload: ShipperLocationPayload, variables: ShipperLocationVariables) => {
      return payload.shipperLocationUpdated.shipperId === variables.shipperId;
    },
  })
  shipperLocationUpdated(@Args('shipperId', { type: () => ID }) shipperId: string) {
    this.logger.debug(`Subscription resolver called for shipper ${shipperId}`);
    return pubSub.asyncIterableIterator('shipperLocationUpdated');
  }
}
