import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  SHIPPER_OFFER_REQUESTED_EVENT,
  type ShipperOfferRequestedEvent,
} from 'src/common/events/shipper-offer-requested.event';
import { ShipperOfferRequestedOrderHandler } from 'src/features/orders/services/order-events.handler';
import { pubSub } from 'src/pubsub';

describe('ShipperOfferRequestedOrderHandler', () => {
  it('rehydrates the Order in Orders before publishing the shipper offer', async () => {
    const eventBus = new InProcessEventBus();
    const orderCoreService = {
      getOrderById: jest.fn().mockResolvedValue({
        id: 'order-1',
        status: 'confirmed',
        shippingDetail: null,
        shippingFee: 20_000,
        shipperEarnings: 16_000,
      }),
    };
    const publish = jest.spyOn(pubSub, 'publish').mockResolvedValue(undefined);
    const handler = new ShipperOfferRequestedOrderHandler(eventBus, orderCoreService as never);
    handler.onModuleInit();

    const event: ShipperOfferRequestedEvent = {
      orderId: 'order-1',
      targetShipperId: 'shipper-1',
      distanceKm: 3,
      priorityScore: 1,
      shippingFee: 20_000,
      shipperEarnings: 16_000,
      shipperCommissionRate: 0.8,
      estimatedDeliveryTime: 30,
    };
    await eventBus.publish(SHIPPER_OFFER_REQUESTED_EVENT, event);

    expect(orderCoreService.getOrderById).toHaveBeenCalledWith('order-1');
    expect(publish).toHaveBeenCalledWith(
      'orderConfirmedForShippers',
      expect.objectContaining({
        orderConfirmedForShippers: expect.objectContaining({ id: 'order-1' }),
        targetShipperId: 'shipper-1',
        distanceKm: 3,
        priorityScore: 1,
      }),
    );
    handler.onModuleDestroy();
    publish.mockRestore();
  });
});
