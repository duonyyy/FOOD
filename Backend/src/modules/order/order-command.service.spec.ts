import { BadRequestException } from '@nestjs/common';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { OrderStatus } from 'src/features/orders/state-machine/order-status';
import { pubSub } from 'src/pubsub';
import { OrderCommandService } from './order-command.service';

describe('OrderCommandService', () => {
  const createCommandService = () => {
    const order = {
      id: 'order-1',
      status: OrderStatus.PENDING,
      user: { id: 'customer-1' },
      isPaid: false,
    };
    const transactionalRepository = {
      findOne: jest.fn(async () => order),
      save: jest.fn(async (value) => value),
    };
    const dependencies = {
      orderRepository: {
        save: jest.fn(async (value) => value),
        manager: {
          transaction: jest.fn(async (callback) =>
            callback({ getRepository: () => transactionalRepository }),
          ),
        },
      },
      orderQueryService: { getOrderById: jest.fn().mockResolvedValue(order) },
      pendingAssignmentService: {
        addPendingAssignment: jest.fn().mockResolvedValue({ id: 'assignment-1' }),
      },
      eventBus: { publish: jest.fn().mockResolvedValue(undefined) },
    };

    return {
      service: new OrderCommandService(
        dependencies.orderRepository as never,
        dependencies.orderQueryService as never,
        dependencies.pendingAssignmentService as never,
        dependencies.eventBus as unknown as InProcessEventBus,
      ),
      dependencies,
      order,
      transactionalRepository,
    };
  };

  afterEach(() => jest.restoreAllMocks());

  it('handles a valid status command and publishes notification after save', async () => {
    const { service, dependencies } = createCommandService();
    const publishSpy = jest.spyOn(pubSub, 'publish').mockResolvedValue(undefined);

    await expect(service.updateStatus('order-1', OrderStatus.CONFIRMED)).resolves.toMatchObject({
      status: OrderStatus.CONFIRMED,
    });

    expect(dependencies.orderRepository.save).toHaveBeenCalled();
    expect(publishSpy).toHaveBeenCalledWith('orderStatusUpdated', {
      orderStatusUpdated: expect.objectContaining({ status: OrderStatus.CONFIRMED }),
    });
    expect(dependencies.eventBus.publish).toHaveBeenCalled();
  });

  it('rejects invalid transitions before saving', async () => {
    const { service, dependencies } = createCommandService();
    dependencies.orderQueryService.getOrderById.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.COMPLETED,
      user: { id: 'customer-1' },
    });

    await expect(service.cancel('order-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(dependencies.orderRepository.save).not.toHaveBeenCalled();
  });

  it('confirms an order and creates a pending assignment', async () => {
    const { service, dependencies } = createCommandService();

    await expect(service.confirm('order-1', 'restaurant-owner-1')).resolves.toMatchObject({
      status: OrderStatus.CONFIRMED,
    });

    expect(dependencies.pendingAssignmentService.addPendingAssignment).toHaveBeenCalledWith(
      'order-1',
      1,
    );
  });

  it('marks a pending payment as completed and paid', async () => {
    const { service, transactionalRepository } = createCommandService();

    await expect(service.markPaid('order-1')).resolves.toMatchObject({
      status: OrderStatus.COMPLETED,
      isPaid: true,
    });
    expect(transactionalRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.COMPLETED, isPaid: true }),
    );
  });

  it('treats a retried payment event as a no-op', async () => {
    const { service, transactionalRepository, order } = createCommandService();
    order.status = OrderStatus.COMPLETED;
    order.isPaid = true;

    await expect(service.markPaid('order-1')).resolves.toBe(order);

    expect(transactionalRepository.save).not.toHaveBeenCalled();
  });
});
