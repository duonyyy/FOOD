import { BadRequestException } from '@nestjs/common';
import { Order } from 'src/entities/order.entity';
import { OrderDeliveryLifecycleCommandService } from 'src/features/orders/services/order-delivery-lifecycle-command.service';
import { pubSub } from 'src/pubsub';

jest.mock('src/pubsub', () => ({ pubSub: { publish: jest.fn().mockResolvedValue(true) } }));

describe('OrderDeliveryLifecycleCommandService', () => {
  let order: Order;
  let repository: { manager: { transaction: jest.Mock }; save: jest.Mock; findOne: jest.Mock };
  let service: OrderDeliveryLifecycleCommandService;

  beforeEach(() => {
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
    service = new OrderDeliveryLifecycleCommandService(repository as never);
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
});
