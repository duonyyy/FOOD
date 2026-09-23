import { Order } from 'src/entities/order.entity';
import { OrderDeliveryService } from 'src/features/orders/services/order-delivery.service';
import { pubSub } from 'src/pubsub';
import { OrderStatus } from 'src/shared/types/enums/order-status.enum';

jest.mock('src/pubsub', () => ({ pubSub: { publish: jest.fn().mockResolvedValue(undefined) } }));

describe('OrderDeliveryService assignment', () => {
  beforeEach(() => jest.clearAllMocks());

  const createService = (status: string) => {
    const order = Object.assign(new Order(), { id: 'order-1', status });
    const repository = {
      manager: {
        transaction: jest.fn((callback: (manager: { getRepository: () => unknown }) => unknown) =>
          callback({
            getRepository: () => ({
              findOne: jest.fn().mockResolvedValue(order),
              save: jest.fn().mockResolvedValue(order),
            }),
          }),
        ),
      },
    };
    return {
      order,
      service: new OrderDeliveryService(repository as never, {} as never, {} as never),
    };
  };

  it('claims a confirmed order through the Orders state machine', async () => {
    const { order, service } = createService(OrderStatus.CONFIRMED);

    await expect(service.claim(order.id)).resolves.toEqual({
      accepted: true,
      orderStatus: OrderStatus.SHIPPER_RECEIVED,
    });
    expect(order.status).toBe(OrderStatus.SHIPPER_RECEIVED);
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(pubSub.publish).toHaveBeenCalledWith('orderStatusUpdated', {
      orderStatusUpdated: order,
    });
  });

  it('is idempotent when the same assignment event is retried', async () => {
    const { service } = createService(OrderStatus.SHIPPER_RECEIVED);

    await expect(service.claim('order-1')).resolves.toEqual({
      accepted: true,
      orderStatus: OrderStatus.SHIPPER_RECEIVED,
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(pubSub.publish).not.toHaveBeenCalled();
  });

  it('does not claim an order from a terminal or unrelated state', async () => {
    const { service } = createService(OrderStatus.CANCELED);

    await expect(service.claim('order-1')).resolves.toEqual({
      accepted: false,
      orderStatus: OrderStatus.CANCELED,
    });
  });
});
