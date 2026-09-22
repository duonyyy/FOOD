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
  const activeShipperTracker = { addShipper: jest.fn() };
  const resolver = new ShipperResolver(
    deliverySubscriptionAccessService as never,
    activeShipperTracker as never,
  );

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
    for (const methodName of ['shipperLocationUpdated', 'orderConfirmedForShippers']) {
      const resolverMethod = getResolverMethod(ShipperResolver.prototype, methodName);
      const guards = Reflect.getMetadata(GUARDS_METADATA, resolverMethod) as unknown[];

      expect(guards).toContain(WebSocketAuthGuard);
    }
  });

  it('rejects a forged shipper ID before mutating the active shipper tracker', async () => {
    await expect(
      resolver.orderConfirmedForShippers('shipper-a', '10.7', '106.6', 20, {
        connection: { context: { user: { id: 'shipper-b' } } },
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(activeShipperTracker.addShipper).not.toHaveBeenCalled();
  });

  it('registers the authenticated shipper before creating the order iterator', async () => {
    const iterator = { next: jest.fn() };
    activeShipperTracker.addShipper.mockResolvedValue({ success: true });
    mockAsyncIterableIterator.mockReturnValue(iterator);

    await expect(
      resolver.orderConfirmedForShippers('shipper-a', '10.7', '106.6', 15, {
        connection: { context: { user: { id: 'shipper-a' } } },
      }),
    ).resolves.toBe(iterator);

    expect(activeShipperTracker.addShipper).toHaveBeenCalledWith('shipper-a', 10.7, 106.6, 15);
    expect(mockAsyncIterableIterator).toHaveBeenCalledWith('orderConfirmedForShippers');
  });

  it('does not create an iterator when Delivery rejects the shipper', async () => {
    activeShipperTracker.addShipper.mockResolvedValue({
      success: false,
      message: 'Shipper is not available',
    });

    await expect(
      resolver.orderConfirmedForShippers('shipper-a', '10.7', '106.6', 20, {
        connection: { context: { user: { id: 'shipper-a' } } },
      }),
    ).rejects.toThrow('Subscription rejected: Shipper is not available');

    expect(mockAsyncIterableIterator).not.toHaveBeenCalled();
  });
});
