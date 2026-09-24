import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { RedisPendingAssignmentStore } from 'src/features/delivery/adapters/redis-pending-assignment-store.service';
import { DeliveryModule } from 'src/features/delivery/delivery.module';
import { ActiveShipperTrackerService } from 'src/features/delivery/services/dispatch/active-shipper-tracker.service';
import { DeliveryDispatchService } from 'src/features/delivery/services/dispatch/delivery-dispatch.service';
import { DeliveryAssignmentSagaService } from 'src/features/delivery/services/shipper/delivery-assignment-saga.service';
import { DeliveryCompletionService } from 'src/features/delivery/services/shipper/delivery-completion.service';
import { ShipperDeliveryService } from 'src/features/delivery/services/shipper/shipper-delivery.service';
import { OrderDeliveryService } from 'src/features/orders/public-api';
import { QueueService } from 'src/infra/queue/public-api';

describe('Delivery provider graph', () => {
  it('constructs the real dispatch and shipper providers without a DI cycle', async () => {
    const providers = Reflect.getMetadata('providers', DeliveryModule) as unknown[];
    expect(providers).toEqual(
      expect.arrayContaining([DeliveryDispatchService, ShipperDeliveryService]),
    );

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
        { provide: DeliveryAssignmentSagaService, useValue: {} },
        { provide: DeliveryCompletionService, useValue: {} },
      ],
    }).compile();

    expect(module.get(DeliveryDispatchService)).toBeInstanceOf(DeliveryDispatchService);
    expect(module.get(ShipperDeliveryService)).toBeInstanceOf(ShipperDeliveryService);
    await module.close();
  });
});
