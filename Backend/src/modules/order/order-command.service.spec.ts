import { BadRequestException } from '@nestjs/common';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { OrderStatus } from 'src/features/orders/state-machine/order-status';
import { pubSub } from 'src/pubsub';
import { OrderCommandService } from './order-command.service';

describe('OrderCommandService', () => {
  const createCommandService = () => {
    type OrderMock = {
      id: string;
      status: OrderStatus;
      user: { id: string };
      isPaid: boolean;
    };
    const order: OrderMock = {
      id: 'order-1',
      status: OrderStatus.PENDING,
      user: { id: 'customer-1' },
      isPaid: false,
    };
    const transactionalRepository = {
      findOne: jest.fn(() => Promise.resolve(order)),
      save: jest.fn((value: OrderMock) => Promise.resolve(value)),
    };
    const transactionManager = { getRepository: () => transactionalRepository };
    const dependencies = {
      orderRepository: {
        save: jest.fn((value: OrderMock) => Promise.resolve(value)),
        manager: {
          transaction: jest.fn((callback: (manager: typeof transactionManager) => unknown) =>
            Promise.resolve(callback(transactionManager)),
          ),
        },
      },
      orderQueryService: { getOrderById: jest.fn(() => Promise.resolve(order)) },
      pendingAssignmentService: {
        addPendingAssignment: jest.fn(() => Promise.resolve({ id: 'assignment-1' })),
      },
      eventBus: { publish: jest.fn(() => Promise.resolve()) },
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
      orderStatusUpdated: expect.objectContaining({ status: OrderStatus.CONFIRMED }) as unknown,
    });
    expect(dependencies.eventBus.publish).toHaveBeenCalled();
  });

  it('rejects invalid transitions before saving', async () => {
    const { service, dependencies } = createCommandService();
    dependencies.orderQueryService.getOrderById.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.COMPLETED,
      user: { id: 'customer-1' },
      isPaid: false,
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

  it('completes an order from DeliveryCompleted', async () => {
    const { service, transactionalRepository, order } = createCommandService();
    const publishSpy = jest.spyOn(pubSub, 'publish').mockResolvedValue(undefined);
    order.status = OrderStatus.DELIVERING;

    await expect(service.completeFromDelivery(order.id)).resolves.toMatchObject({
      status: OrderStatus.COMPLETED,
    });

    expect(transactionalRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.COMPLETED }),
    );
    expect(publishSpy).toHaveBeenCalledWith('orderStatusUpdated', {
      orderStatusUpdated: expect.objectContaining({ status: OrderStatus.COMPLETED }) as unknown,
    });
  });

  it('handles a retried DeliveryCompleted event idempotently', async () => {
    const { service, transactionalRepository, order } = createCommandService();
    const publishSpy = jest.spyOn(pubSub, 'publish').mockResolvedValue(undefined);
    order.status = OrderStatus.COMPLETED;

    await expect(service.completeFromDelivery(order.id)).resolves.toBe(order);

    expect(transactionalRepository.save).not.toHaveBeenCalled();
    expect(publishSpy).not.toHaveBeenCalled();
  });
});
