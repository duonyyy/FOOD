import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { WebSocketAuthGuard } from 'src/features/auth/public-api';
import { ShipperResolver } from 'src/features/delivery/controllers/shipper.resolver';

jest.mock('src/pubsub', () => {
  const asyncIterableIterator = jest.fn();
  return {
    pubSub: { asyncIterableIterator },
    __testDoubles: { asyncIterableIterator },
  };
});

const pubSubTestDoubles = jest.requireMock<{
  __testDoubles: { asyncIterableIterator: jest.Mock };
}>('src/pubsub');
const mockAsyncIterableIterator = pubSubTestDoubles.__testDoubles.asyncIterableIterator;

function getResolverMethod(prototype: object, methodName: string): () => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName) as
    | TypedPropertyDescriptor<() => unknown>
    | undefined;

  if (typeof descriptor?.value !== 'function') {
    throw new Error(`Expected ${methodName} to be a resolver method`);
  }

  return descriptor.value;
}

describe('ShipperResolver authorization', () => {
  const deliverySubscriptionAccessService = {
    canAccessShipperLocation: jest.fn(),
  };
  const resolver = new ShipperResolver(deliverySubscriptionAccessService as never);

  beforeEach(() => jest.clearAllMocks());

  it('rejects another customer before creating a location iterator', async () => {
    deliverySubscriptionAccessService.canAccessShipperLocation.mockResolvedValue(false);

    await expect(
      resolver.shipperLocationUpdated('shipper-a', {
        connection: { context: { user: { id: 'customer-b' } } },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(deliverySubscriptionAccessService.canAccessShipperLocation).toHaveBeenCalledWith(
      'customer-b',
      'shipper-a',
    );
    expect(mockAsyncIterableIterator).not.toHaveBeenCalled();
  });

  it('applies WebSocket authentication before resolving the subscription', () => {
    const resolverMethod = getResolverMethod(ShipperResolver.prototype, 'shipperLocationUpdated');
    const guards = Reflect.getMetadata(GUARDS_METADATA, resolverMethod) as unknown[];

    expect(guards).toContain(WebSocketAuthGuard);
  });
});
