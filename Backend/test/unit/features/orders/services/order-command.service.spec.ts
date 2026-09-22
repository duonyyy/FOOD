import { BadRequestException } from '@nestjs/common';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import { AdminOrdersService } from 'src/features/orders/services/admin-orders.service';
import { MerchantOrdersService } from 'src/features/orders/services/merchant-orders.service';
import { pubSub } from 'src/pubsub';
import { OrderStatus } from 'src/shared/types/enums/order-status.enum';

describe('MerchantOrdersService and AdminOrdersService commands', () => {
  const createServices = () => {
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
      orderCoreService: {
        getOrderById: jest.fn(() => Promise.resolve(order)),
        cleanSensitiveData: jest.fn((val: unknown) => val),
      },
      eventBus: { publish: jest.fn(() => Promise.resolve()) },
      outboxService: {
        enqueue: jest.fn(() => Promise.resolve({ id: 'status-event-1' })),
        dispatchAfterCommit: jest.fn(() => Promise.resolve()),
      },
      paymentCheckoutCommands: {
        cancelPendingCheckoutForOrder: jest.fn(() => Promise.resolve()),
      },
    };

    const merchantService = new MerchantOrdersService(
      dependencies.orderRepository as never,
      dependencies.orderCoreService as never,
      dependencies.eventBus as unknown as InProcessEventBus,
      dependencies.outboxService as never,
    );

    const adminService = new AdminOrdersService(
      dependencies.orderRepository as never,
      dependencies.orderCoreService as never,
      dependencies.eventBus as unknown as InProcessEventBus,
      dependencies.outboxService as never,
      dependencies.paymentCheckoutCommands as never,
    );

    return {
      merchantService,
      adminService,
      dependencies,
      order,
      transactionalRepository,
      transactionManager,
    };
  };

  afterEach(() => jest.restoreAllMocks());

  it('handles a valid status command and publishes notification after save', async () => {
    const { merchantService, dependencies, transactionalRepository } = createServices();
    const publishSpy = jest.spyOn(pubSub, 'publish').mockResolvedValue(undefined);

    await expect(
      merchantService.updateOrderStatus('order-1', OrderStatus.CONFIRMED),
    ).resolves.toMatchObject({
      status: OrderStatus.CONFIRMED,
    });

    expect(transactionalRepository.save).toHaveBeenCalled();
    expect(publishSpy).toHaveBeenCalledWith('orderStatusUpdated', {
      orderStatusUpdated: expect.objectContaining({ status: OrderStatus.CONFIRMED }) as unknown,
    });
    expect(dependencies.eventBus.publish).toHaveBeenCalled();
  });

  it('rejects invalid transitions before saving', async () => {
    const { merchantService, dependencies } = createServices();
    dependencies.orderCoreService.getOrderById.mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.COMPLETED,
      user: { id: 'customer-1' },
      isPaid: false,
    });

    await expect(merchantService.cancelOrder('order-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(dependencies.orderRepository.save).not.toHaveBeenCalled();
  });

  it('confirms an order and publishes the status change for Delivery', async () => {
    const { merchantService, dependencies, transactionManager } = createServices();

    await expect(
      merchantService.confirmOrder('order-1', 'restaurant-owner-1'),
    ).resolves.toMatchObject({
      status: OrderStatus.CONFIRMED,
    });

    expect(dependencies.outboxService.enqueue).toHaveBeenCalledWith(
      transactionManager,
      expect.objectContaining({
        eventType: 'ordering.order.status-changed',
        aggregateId: 'order-1',
        payload: expect.objectContaining({
          orderId: 'order-1',
          previousStatus: OrderStatus.PENDING,
          status: OrderStatus.CONFIRMED,
        }) as unknown,
      }),
    );
    expect(dependencies.outboxService.dispatchAfterCommit).toHaveBeenCalledWith('status-event-1');
  });

  it('does not commit a status transition when the Outbox row cannot be stored', async () => {
    const { merchantService, dependencies } = createServices();
    dependencies.outboxService.enqueue.mockRejectedValueOnce(new Error('Outbox unavailable'));

    await expect(
      merchantService.updateOrderStatus('order-1', OrderStatus.CONFIRMED),
    ).rejects.toThrow('Outbox unavailable');

    expect(dependencies.outboxService.dispatchAfterCommit).not.toHaveBeenCalled();
  });

  it('returns the committed order when immediate dispatch fails and leaves retry to Outbox', async () => {
    const { merchantService, dependencies } = createServices();
    dependencies.outboxService.dispatchAfterCommit.mockRejectedValueOnce(
      new Error('Delivery unavailable'),
    );

    await expect(
      merchantService.updateOrderStatus('order-1', OrderStatus.CONFIRMED),
    ).resolves.toMatchObject({ status: OrderStatus.CONFIRMED });

    expect(dependencies.outboxService.enqueue).toHaveBeenCalled();
  });

  it('marks a pending payment as completed and paid', async () => {
    const { adminService, transactionalRepository } = createServices();

    await expect(adminService.markPaid('order-1')).resolves.toMatchObject({
      status: OrderStatus.COMPLETED,
      isPaid: true,
    });
    expect(transactionalRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: OrderStatus.COMPLETED, isPaid: true }),
    );
  });

  it('treats a retried payment event as a no-op', async () => {
    const { adminService, transactionalRepository, order } = createServices();
    order.status = OrderStatus.COMPLETED;
    order.isPaid = true;

    await expect(adminService.markPaid('order-1')).resolves.toBe(order);

    expect(transactionalRepository.save).not.toHaveBeenCalled();
  });

  it('completes an order from DeliveryCompleted', async () => {
    const { adminService, transactionalRepository, order } = createServices();
    const publishSpy = jest.spyOn(pubSub, 'publish').mockResolvedValue(undefined);
    order.status = OrderStatus.DELIVERING;

    await expect(adminService.completeFromDelivery(order.id)).resolves.toMatchObject({
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
    const { adminService, transactionalRepository, order } = createServices();
    const publishSpy = jest.spyOn(pubSub, 'publish').mockResolvedValue(undefined);
    order.status = OrderStatus.COMPLETED;

    await expect(adminService.completeFromDelivery(order.id)).resolves.toBe(order);

    expect(transactionalRepository.save).not.toHaveBeenCalled();
    expect(publishSpy).not.toHaveBeenCalled();
  });
});
