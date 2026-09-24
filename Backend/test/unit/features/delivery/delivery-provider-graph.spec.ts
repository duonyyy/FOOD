import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { OutboxService } from 'src/common/events/outbox.service';
import { DeliveryEarningsEvent } from 'src/entities/deliveryEarningsEvent.entity';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { RedisPendingAssignmentStore } from 'src/features/delivery/adapters/redis-pending-assignment-store.service';
import { DeliveryModule } from 'src/features/delivery/delivery.module';
import { ActiveShipperTrackerService } from 'src/features/delivery/services/dispatch/active-shipper-tracker.service';
import { DeliveryDispatchService } from 'src/features/delivery/services/delivery-dispatch.service';
import { DeliveryTripService } from 'src/features/delivery/services/delivery-trip.service';
import { ShipperDeliveryService } from 'src/features/delivery/services/shipper-delivery.service';
import { OrderDeliveryService } from 'src/features/orders/public-api';
import { QueueService } from 'src/infra/queue/public-api';

describe('Delivery provider graph', () => {
  it('constructs the real dispatch and shipper providers without a DI cycle', async () => {
    const providers = Reflect.getMetadata('providers', DeliveryModule) as unknown[];
    expect(providers).toEqual(
      expect.arrayContaining([DeliveryDispatchService, DeliveryTripService, ShipperDeliveryService]),
    );
    expect(providers.filter((provider) => provider === DeliveryTripService)).toHaveLength(1);

    const module = await Test.createTestingModule({
      providers: [
        DeliveryDispatchService,
        ShipperDeliveryService,
        { provide: getRepositoryToken(ShippingDetail), useValue: {} },
        { provide: getRepositoryToken(ShipperProfile), useValue: {} },
        { provide: OrderDeliveryService, useValue: {} },
        { provide: QueueService, useValue: {} },
        { provide: RedisPendingAssignmentStore, useValue: {} },
        { provide: ActiveShipperTrackerService, useValue: {} },
        { provide: InProcessEventBus, useValue: {} },
        { provide: DeliveryTripService, useValue: {} },
      ],
    }).compile();

    expect(module.get(DeliveryDispatchService)).toBeInstanceOf(DeliveryDispatchService);
    expect(module.get(ShipperDeliveryService)).toBeInstanceOf(ShipperDeliveryService);
    await module.close();
  });

  it('constructs the single trip provider with its owned repositories and Orders API', async () => {
    const module = await Test.createTestingModule({
      providers: [
        DeliveryTripService,
        { provide: getRepositoryToken(ShippingDetail), useValue: {} },
        { provide: getRepositoryToken(ShipperProfile), useValue: {} },
        { provide: getRepositoryToken(DeliveryEarningsEvent), useValue: {} },
        { provide: OrderDeliveryService, useValue: {} },
        { provide: OutboxService, useValue: {} },
      ],
    }).compile();

    expect(module.get(DeliveryTripService)).toBeInstanceOf(DeliveryTripService);
    await module.close();
  });
});
