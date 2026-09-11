import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { WebSocketAuthGuard } from 'src/features/auth/public-api';
import { OrderResolver } from 'src/features/orders/controllers/order.resolver';

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

describe('OrderResolver authorization', () => {
  const activeShipperTracker = { addShipper: jest.fn() };
  const restaurantReader = { findActiveRestaurant: jest.fn() };
  const resolver = new OrderResolver(activeShipperTracker as never, restaurantReader as never);

  beforeEach(() => jest.clearAllMocks());

  it('rejects a customer trying to subscribe to another customer order status', () => {
    expect(() =>
      resolver.orderStatusUpdated('customer-a', {
        connection: { context: { user: { id: 'customer-b' } } },
      }),
    ).toThrow(ForbiddenException);
    expect(mockAsyncIterableIterator).not.toHaveBeenCalled();
  });

  it('rejects a non-owner before creating a restaurant order subscription', async () => {
    restaurantReader.findActiveRestaurant.mockResolvedValue({
      restaurantId: 'restaurant-a',
      ownerId: 'merchant-a',
      name: 'Restaurant A',
      isActive: true,
      location: null,
    });

    await expect(
      resolver.orderCreated('restaurant-a', {
        connection: { context: { user: { id: 'merchant-b' } } },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mockAsyncIterableIterator).not.toHaveBeenCalled();
  });

  it('rejects a forged shipper ID before mutating the active shipper tracker', async () => {
    await expect(
      resolver.orderConfirmedForShippers('shipper-a', '10.7', '106.6', 20, {
        connection: { context: { user: { id: 'shipper-b' } } },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(activeShipperTracker.addShipper).not.toHaveBeenCalled();
  });

  it('uses WebSocket authentication on every subscription and removes debug operations', () => {
    for (const methodName of ['orderCreated', 'orderStatusUpdated', 'orderConfirmedForShippers']) {
      const resolverMethod = getResolverMethod(OrderResolver.prototype, methodName);
      const guards = Reflect.getMetadata(GUARDS_METADATA, resolverMethod) as unknown[];
      expect(guards).toContain(WebSocketAuthGuard);
    }

    expect(resolver).not.toHaveProperty('triggerShipperCleanup');
    expect(resolver).not.toHaveProperty('getShipperQueueStatus');
    expect(resolver).not.toHaveProperty('findBestShipperForLocation');
  });
});
