import { Args, ID, Resolver, Subscription } from '@nestjs/graphql';
import { pubSub } from 'src/pubsub';
import { ShipperLocation } from './shipper-location.type';

@Resolver()
export class ShipperResolver {
  @Subscription(() => ShipperLocation, {
    filter: (payload, variables) => {
      console.log('Filter:', payload.shipperLocationUpdated.shipperId, variables.shipperId);
      return payload.shipperLocationUpdated.shipperId === variables.shipperId;
    },
  })
  shipperLocationUpdated(@Args('shipperId', { type: () => ID }) shipperId: string) {
    console.log('Subscription resolver called for shipperId:', shipperId);
    return pubSub.asyncIterableIterator('shipperLocationUpdated');
  }
}
