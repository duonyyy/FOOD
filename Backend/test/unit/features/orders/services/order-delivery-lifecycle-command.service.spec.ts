import { BadRequestException } from '@nestjs/common';
import { ORDER_STATUS_CHANGED_EVENT } from 'src/common/events/order-events';
import { Order } from 'src/entities/order.entity';
import { OrderDeliveryService } from 'src/features/orders/services/order-delivery.service';
import { pubSub } from 'src/pubsub';

jest.mock('src/pubsub', () => ({ pubSub: { publish: jest.fn().mockResolvedValue(true) } }));

describe('OrderDeliveryService lifecycle', () => {
  let order: Order;
  let repository: { manager: { transaction: jest.Mock }; save: jest.Mock; findOne: jest.Mock };
  let service: OrderDeliveryService;
  const eventBus = { publish: jest.fn().mockResolvedValue(undefined) };
  const outboxService = {
    enqueue: jest.fn().mockResolvedValue({ id: 'status-event-1' }),
    dispatchAfterCommit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    order = Object.assign(new Order(), { id: 'order-1', status: 'shipper_received' });
    repository = {
      findOne: jest.fn().mockResolvedValue(order),
      save: jest.fn().mockImplementation((value: Order) => Promise.resolve(value)),
      manager: {
        transaction: jest.fn((callback: (manager: { getRepository: () => unknown }) => unknown) =>
          callback({ getRepository: () => repository }),
        ),
      },
    };
    service = new OrderDeliveryService(
      repository as never,
      eventBus as never,
      outboxService as never,
    );
  });

  it('is the only writer for the shipper_received -> delivering transition', async () => {
    await expect(service.startDelivery('order-1')).resolves.toEqual({
      orderId: 'order-1',
      status: 'delivering',
    });
    expect(repository.save).toHaveBeenCalledWith(order);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(pubSub.publish as jest.Mock).toHaveBeenCalledWith('orderStatusUpdated', {
      orderStatusUpdated: order,
    });
  });

  it('rejects a start when the order has not been received by a shipper', async () => {
    order.status = 'confirmed';
    await expect(service.startDelivery('order-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('cancels only an active delivery and makes a repeated cancel idempotent', async () => {
    order.status = 'delivering';
    await expect(service.cancelDelivery('order-1')).resolves.toEqual({
      orderId: 'order-1',
      status: 'canceled',
    });
    repository.save.mockClear();
    await expect(service.cancelDelivery('order-1')).resolves.toEqual({
      orderId: 'order-1',
      status: 'canceled',
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('cancels an unassigned confirmed order on Delivery timeout', async () => {
    order.status = 'confirmed';
    order.shippingDetail = null as never;
    order.user = { id: 'customer-1' } as never;

    await expect(service.cancelUnassigned('order-1')).resolves.toEqual({
      orderId: 'order-1',
      status: 'canceled',
    });

    expect(repository.save).toHaveBeenCalledWith(order);
    expect(outboxService.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: ORDER_STATUS_CHANGED_EVENT,
        payload: expect.objectContaining({
          orderId: 'order-1',
          previousStatus: 'confirmed',
          status: 'canceled',
        }) as unknown,
      }),
    );
    expect(outboxService.dispatchAfterCommit).toHaveBeenCalledWith('status-event-1');
  });
});
