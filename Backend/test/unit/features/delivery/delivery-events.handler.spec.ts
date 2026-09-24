import { DELIVERY_ASSIGNMENT_CLAIMED_EVENT } from 'src/common/events/delivery-assignment.events';
import { DELIVERY_COMPLETED_EVENT } from 'src/common/events/delivery-completed.event';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { ORDER_STATUS_CHANGED_EVENT } from 'src/common/events/order-events';
import { DeliveryEventsHandler } from 'src/features/delivery/handlers/delivery-events.handler';

describe('DeliveryEventsHandler - order and trip events', () => {
  const eventBus = new InProcessEventBus();
  const deliveryDispatchService = {
    addPendingAssignment: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
    removePendingAssignment: jest.fn().mockResolvedValue(undefined),
  };
  const trip = { activate: jest.fn(), cancelReservation: jest.fn(), project: jest.fn() };
  const handler = new DeliveryEventsHandler(
    eventBus,
    deliveryDispatchService as never,
    trip as never,
  );

  beforeAll(() => handler.onModuleInit());
  beforeEach(() => jest.clearAllMocks());
  afterAll(() => handler.onModuleDestroy());

  it('creates a pending assignment when Orders confirms an unassigned order', async () => {
    await eventBus.publish(ORDER_STATUS_CHANGED_EVENT, {
      orderId: 'order-1',
      previousStatus: 'pending',
      status: 'confirmed',
      hasShippingDetail: false,
      occurredAt: new Date().toISOString(),
    });

    expect(deliveryDispatchService.addPendingAssignment).toHaveBeenCalledWith('order-1', 1);
    expect(deliveryDispatchService.removePendingAssignment).not.toHaveBeenCalled();
  });

  it('removes the pending assignment when an order leaves confirmed', async () => {
    await eventBus.publish(ORDER_STATUS_CHANGED_EVENT, {
      orderId: 'order-1',
      previousStatus: 'confirmed',
      status: 'canceled',
      hasShippingDetail: false,
      occurredAt: new Date().toISOString(),
    });

    expect(deliveryDispatchService.removePendingAssignment).toHaveBeenCalledWith('order-1');
    expect(deliveryDispatchService.addPendingAssignment).not.toHaveBeenCalled();
  });

  it('does not create a pending assignment for an order that already has a delivery', async () => {
    await eventBus.publish(ORDER_STATUS_CHANGED_EVENT, {
      orderId: 'order-1',
      previousStatus: 'pending',
      status: 'confirmed',
      hasShippingDetail: true,
      occurredAt: new Date().toISOString(),
    });

    expect(deliveryDispatchService.addPendingAssignment).not.toHaveBeenCalled();
  });

  it('propagates Delivery errors so Outbox can retry the event', async () => {
    deliveryDispatchService.addPendingAssignment.mockRejectedValueOnce(
      new Error('Redis unavailable'),
    );

    await expect(
      eventBus.publish(ORDER_STATUS_CHANGED_EVENT, {
        orderId: 'order-1',
        previousStatus: 'pending',
        status: 'confirmed',
        hasShippingDetail: false,
        occurredAt: new Date().toISOString(),
      }),
    ).rejects.toThrow('Redis unavailable');
  });

  it('routes assignment and completion events to their owners once', async () => {
    await eventBus.publish(DELIVERY_ASSIGNMENT_CLAIMED_EVENT, {
      orderId: 'order-1',
      shipperId: 'shipper-a',
      shippingDetailId: 'detail-1',
    });
    await eventBus.publish(DELIVERY_COMPLETED_EVENT, {
      orderId: 'order-1',
      customerId: 'customer-a',
      shipperId: 'shipper-a',
      shippingDetailId: 'detail-1',
      completedAt: new Date().toISOString(),
      earnings: 10000,
      deliveryTimeMinutes: 20,
      onTime: true,
    });
    expect(trip.activate).toHaveBeenCalledTimes(1);
    expect(trip.project).toHaveBeenCalledTimes(1);
  });
});
