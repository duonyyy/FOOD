import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { ORDER_STATUS_CHANGED_EVENT } from 'src/common/events/order-events';
import { OrderStatusDeliveryHandler } from 'src/features/delivery/services/dispatch/order-status-delivery.handler';

describe('OrderStatusDeliveryHandler', () => {
  const eventBus = new InProcessEventBus();
  const deliveryDispatchService = {
    addPendingAssignment: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
    removePendingAssignment: jest.fn().mockResolvedValue(undefined),
  };
  const handler = new OrderStatusDeliveryHandler(eventBus, deliveryDispatchService as never);

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
});
