import {
  DELIVERY_ASSIGNMENT_REQUESTED_EVENT,
  type DeliveryAssignmentRequestedEvent,
} from 'src/common/events/delivery-assignment.events';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { DeliveryEventsHandler } from 'src/features/delivery/handlers/delivery-events.handler';
import { DeliveryTripService } from 'src/features/delivery/services/delivery-trip.service';
import { SHIPPER_PROFILE_STATUS } from 'src/features/delivery/types/shipper-profile.types';
import { DeliveryAssignmentRequestedOrderHandler } from 'src/features/orders/services/order-events.handler';

describe('DeliveryTripService - assignment', () => {
  let shippingDetail: ShippingDetail | null;
  let profile: ShipperProfile;
  let shippingRepository: Record<string, jest.Mock | { transaction: jest.Mock }>;
  let profileRepository: Record<string, jest.Mock>;
  let outbox: Record<string, jest.Mock>;
  let eventBus: InProcessEventBus;
  let assignmentRequest: DeliveryAssignmentRequestedEvent | undefined;

  beforeEach(() => {
    shippingDetail = null;
    profile = Object.assign(new ShipperProfile(), {
      userId: 'shipper-1',
      certificateStatus: SHIPPER_PROFILE_STATUS.APPROVED,
      isAvailable: true,
      activeDeliveries: 0,
      maxActiveDeliveries: 3,
      responseTimeMinutes: 0,
    });
    profileRepository = {
      findOne: jest
        .fn()
        .mockImplementation(({ where }: { where: { userId: string } }) =>
          Promise.resolve(where.userId === profile.userId ? profile : null),
        ),
      save: jest.fn().mockResolvedValue(profile),
    };
    shippingRepository = {
      findOne: jest
        .fn()
        .mockImplementation(({ where }: { where: { id?: string } }) =>
          Promise.resolve(where.id ? shippingDetail : shippingDetail),
        ),
      create: jest.fn((value: Partial<ShippingDetail>) =>
        Object.assign(new ShippingDetail(), { id: 'shipping-1', ...value }),
      ),
      save: jest.fn((value: ShippingDetail) => {
        shippingDetail = value;
        return Promise.resolve(value);
      }),
      manager: {
        transaction: jest.fn(
          (callback: (manager: { getRepository: (entity: unknown) => unknown }) => unknown) =>
            callback({
              getRepository: (entity: unknown) =>
                entity === ShippingDetail ? shippingRepository : profileRepository,
            }),
        ),
      },
    };
    eventBus = new InProcessEventBus();
    outbox = {
      enqueue: jest
        .fn()
        .mockImplementation(
          (_manager: unknown, request: { payload: DeliveryAssignmentRequestedEvent }) => {
            assignmentRequest = request.payload;
            return Promise.resolve({ id: 'outbox-1', payload: request.payload });
          },
        ),
      dispatchAfterCommit: jest.fn(),
    };
  });

  const wireSaga = (claim: { accepted: boolean; orderStatus: string }) => {
    const saga = new DeliveryTripService(
      shippingRepository as never,
      profileRepository as never,
      undefined as never,
      undefined as never,
      outbox as never,
    );
    const orderCommands = { claim: jest.fn().mockResolvedValue(claim) };
    const orderHandler = new DeliveryAssignmentRequestedOrderHandler(
      eventBus,
      orderCommands as never,
    );
    const deliveryHandler = new DeliveryEventsHandler(eventBus, {} as never, saga);
    deliveryHandler.onModuleInit();
    orderHandler.onModuleInit();
    outbox.dispatchAfterCommit.mockImplementation(async () => {
      if (!assignmentRequest) throw new Error('Missing assignment request');
      await eventBus.publish(DELIVERY_ASSIGNMENT_REQUESTED_EVENT, assignmentRequest);
    });
    return { saga, orderCommands, orderHandler, deliveryHandler };
  };

  it('activates the Delivery reservation only after Orders claims the order', async () => {
    const { saga, orderCommands, orderHandler, deliveryHandler } = wireSaga({
      accepted: true,
      orderStatus: 'shipper_received',
    });

    const result = await saga.assign('order-1', 'shipper-1', 90);

    expect(orderCommands.claim).toHaveBeenCalledWith('order-1');
    expect(result.status).toBe(ShippingStatus.SHIPPING);
    expect(profile.activeDeliveries).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: DELIVERY_ASSIGNMENT_REQUESTED_EVENT,
        idempotencyKey: 'delivery-assignment-requested:order-1',
      }),
    );
    orderHandler.onModuleDestroy();
    deliveryHandler.onModuleDestroy();
  });

  it('cancels the Delivery reservation when Orders rejects the assignment', async () => {
    const { saga, orderHandler, deliveryHandler } = wireSaga({
      accepted: false,
      orderStatus: 'canceled',
    });

    const result = await saga.assign('order-1', 'shipper-1', 90);

    expect(result.status).toBe(ShippingStatus.CANCELLED);
    expect(profile.activeDeliveries).toBe(0);
    orderHandler.onModuleDestroy();
    deliveryHandler.onModuleDestroy();
  });

  it('keeps the reservation pending for Outbox retry when dispatch is temporarily unavailable', async () => {
    const saga = new DeliveryTripService(
      shippingRepository as never,
      profileRepository as never,
      undefined as never,
      undefined as never,
      outbox as never,
    );
    outbox.dispatchAfterCommit.mockRejectedValue(new Error('event bus unavailable'));

    const result = await saga.assign('order-1', 'shipper-1', 90);

    expect(result.status).toBe(ShippingStatus.PENDING);
    expect(profile.activeDeliveries).toBe(1);
    expect(outbox.enqueue).toHaveBeenCalledTimes(1);
  });
});
