import { Test } from '@nestjs/testing';
import { DELIVERY_COMPLETED_EVENT } from 'src/common/events/delivery-completed.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { DeliveryModule } from 'src/features/delivery/delivery.module';
import { DeliveryEventsHandler } from 'src/features/delivery/handlers/delivery-events.handler';
import { DeliveryDispatchService } from 'src/features/delivery/services/delivery-dispatch.service';
import { DeliveryTripService } from 'src/features/delivery/services/delivery-trip.service';

describe('Delivery event handler runtime', () => {
  it('registers the handler only once in DeliveryModule', () => {
    const providers = Reflect.getMetadata('providers', DeliveryModule) as unknown[];
    expect(providers.filter((provider) => provider === DeliveryEventsHandler)).toHaveLength(1);
  });

  it('registers one subscriber per event and removes them on shutdown', async () => {
    const eventBus = new InProcessEventBus();
    const subscribe = jest.spyOn(eventBus, 'subscribe');
    const earnings = { project: jest.fn().mockResolvedValue(true) };
    const module = await Test.createTestingModule({
      providers: [
        DeliveryEventsHandler,
        { provide: InProcessEventBus, useValue: eventBus },
        { provide: DeliveryDispatchService, useValue: {} },
        { provide: DeliveryTripService, useValue: earnings },
      ],
    }).compile();

    await module.init();
    const handler = module.get(DeliveryEventsHandler);
    handler.onModuleInit();
    expect(subscribe).toHaveBeenCalledTimes(4);
    expect(new Set(subscribe.mock.calls.map(([eventName]) => eventName)).size).toBe(4);

    const event = {
      orderId: 'order-1',
      customerId: 'customer-1',
      shipperId: 'shipper-1',
      shippingDetailId: 'detail-1',
      completedAt: new Date().toISOString(),
      earnings: 20_000,
      deliveryTimeMinutes: 20,
      onTime: true,
    };
    await eventBus.publish(DELIVERY_COMPLETED_EVENT, event);
    expect(earnings.project).toHaveBeenCalledTimes(1);

    await module.close();
    await eventBus.publish(DELIVERY_COMPLETED_EVENT, event);
    expect(earnings.project).toHaveBeenCalledTimes(1);
  });
});
