import { BadRequestException, ConflictException } from '@nestjs/common';
import { Order } from 'src/entities/order.entity';
import { DefaultRole } from 'src/entities/role.entity';
import { CertificateStatus } from 'src/entities/shipperCertificateInfo.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { ShipperService } from 'src/features/delivery/services/shipper/shipper.service';
import { pubSub } from 'src/pubsub';

jest.mock('src/pubsub', () => ({ pubSub: { publish: jest.fn().mockResolvedValue(true) } }));

describe('Shipper delivery transition and concurrency baseline', () => {
  let order: Order;
  let shippingDetail: ShippingDetail | null;
  let shippers: Map<string, User>;
  let orderRepository: Record<string, jest.Mock | object>;
  let shippingRepository: Record<string, jest.Mock>;
  let userRepository: Record<string, jest.Mock>;
  let pending: Record<string, jest.Mock>;
  let completionService: { complete: jest.Mock };
  let service: ShipperService;

  type TransactionManagerMock = {
    getRepository: (entity: unknown) => unknown;
  };

  beforeEach(() => {
    order = Object.assign(new Order(), {
      id: 'order-1',
      status: 'confirmed',
      shippingFee: 25_000,
      deliveryDistance: 2,
      total: 100_000,
      estimatedDeliveryTime: 30,
    });
    shippingDetail = null;
    shippers = new Map(
      ['shipper-a', 'shipper-b'].map((id) => [
        id,
        Object.assign(new User(), {
          id,
          role: { name: DefaultRole.SHIPPER },
          shipperCertificateInfo: { status: CertificateStatus.APPROVED },
          activeDeliveries: 0,
          completedDeliveries: 0,
          totalEarnings: 0,
        }),
      ]),
    );

    shippingRepository = {
      findOne: jest.fn(() => Promise.resolve(shippingDetail)),
      create: jest.fn((value: Partial<ShippingDetail>) =>
        Object.assign(new ShippingDetail(), value),
      ),
      save: jest.fn((value: ShippingDetail) => {
        shippingDetail = value;
        return Promise.resolve(value);
      }),
    };
    userRepository = {
      findOne: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(shippers.get(where.id) || null),
      ),
      save: jest.fn((value: User) => Promise.resolve(value)),
    };

    let transactionTail = Promise.resolve();
    const manager: TransactionManagerMock = {
      getRepository: (entity: unknown) => {
        if (entity === Order) return orderRepository;
        if (entity === ShippingDetail) return shippingRepository;
        if (entity === User) return userRepository;
        throw new Error('Unexpected repository');
      },
    };
    orderRepository = {
      findOne: jest.fn(() => Promise.resolve(order)),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        setLock: jest.fn().mockReturnThis(),
        getOne: jest.fn(() => Promise.resolve(order)),
      })),
      save: jest.fn((value: Order) => Promise.resolve(value)),
      manager: {
        transaction: jest.fn((callback: (manager: TransactionManagerMock) => unknown) => {
          const result = transactionTail.then(() => callback(manager));
          transactionTail = result.then(
            () => undefined,
            () => undefined,
          );
          return result;
        }),
      },
    };
    pending = {
      getPendingAssignmentForShipper: jest.fn((shipperId: string) =>
        Promise.resolve({
          assignmentId: `assignment-${shipperId}`,
          orderId: order.id,
          shipperId,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ),
      getActiveHoldForOrder: jest.fn().mockResolvedValue(null),
      createShipperHold: jest.fn().mockResolvedValue({
        assignmentId: 'assignment-1',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      markOfferRejected: jest.fn().mockResolvedValue(undefined),
      removePendingAssignment: jest.fn().mockResolvedValue(undefined),
    };
    completionService = { complete: jest.fn() };
    service = new ShipperService(
      orderRepository as never,
      shippingRepository as never,
      userRepository as never,
      {} as never,
      pending as never,
      completionService as never,
    );
  });

  it('creates an offer only for a confirmed, unassigned order and approved shipper', async () => {
    pending.getPendingAssignmentForShipper.mockResolvedValueOnce(null);

    const result = await service.requestOrderAssignment(order.id, 'shipper-a');

    expect(result.assignmentId).toBe('assignment-1');
    expect(pending.createShipperHold).toHaveBeenCalledWith(order.id, 'shipper-a');
  });

  it('allows only one winner when two shippers concurrently accept the same order', async () => {
    const results = await Promise.allSettled([
      service.assignOrderToShipper(order.id, 'shipper-a'),
      service.assignOrderToShipper(order.id, 'shipper-b'),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(results.find((result) => result.status === 'rejected')).toMatchObject({
      reason: expect.any(ConflictException) as unknown,
    });
    expect(shippingRepository.save).toHaveBeenCalledTimes(1);
    expect(order.status).toBe('shipper_received');
  });

  it('does not create a duplicate shipping detail when the winning accept is retried', async () => {
    await service.assignOrderToShipper(order.id, 'shipper-a');

    await expect(service.assignOrderToShipper(order.id, 'shipper-a')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(shippingRepository.save).toHaveBeenCalledTimes(1);
  });

  it('does not reassign an order after a concurrent accept has committed', async () => {
    shippingDetail = Object.assign(new ShippingDetail(), {
      order,
      shipper: shippers.get('shipper-a'),
      status: ShippingStatus.SHIPPING,
    });

    await service.reassignOrder(order.id);

    expect(pending.removePendingAssignment).toHaveBeenCalledWith(order.id);
    // The mocked publisher is inspected, not invoked without its receiver.
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(pubSub.publish).not.toHaveBeenCalledWith('orderReassignedToShippers', expect.anything());
  });

  it('rejects an expired offer and schedules it for another shipper', async () => {
    pending.getPendingAssignmentForShipper.mockResolvedValueOnce({
      assignmentId: 'expired-assignment',
      orderId: order.id,
      shipperId: 'shipper-a',
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(
      service.acceptAssignment('expired-assignment', 'shipper-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pending.markOfferRejected).toHaveBeenCalledWith(order.id, 'shipper-a');
  });

  it('records rejection through the pending-assignment retry path', async () => {
    await service.rejectOrder(order.id, 'shipper-a', 20);

    expect(pending.markOfferRejected).toHaveBeenCalledWith(order.id, 'shipper-a');
    expect(shippers.get('shipper-a')?.rejectedOrders).toBe(1);
  });

  it('keeps get-order read-only for an assigned shipper', async () => {
    order.status = 'shipper_received';
    shippingDetail = Object.assign(new ShippingDetail(), {
      order,
      shipper: shippers.get('shipper-a'),
      status: ShippingStatus.SHIPPING,
    });

    const result = await service.getOrder(order.id, 'shipper-a');

    expect(result.status).toBe('shipper_received');
    expect(orderRepository.save).not.toHaveBeenCalled();
    expect(shippingRepository.save).not.toHaveBeenCalled();
  });

  it('starts delivery only through the explicit start-order command', async () => {
    order.status = 'shipper_received';
    shippingDetail = Object.assign(new ShippingDetail(), {
      order,
      shipper: shippers.get('shipper-a'),
      status: ShippingStatus.SHIPPING,
    });

    const result = await service.startOrder(order.id, 'shipper-a');

    expect(result.status).toBe('delivering');
    expect(orderRepository.save).toHaveBeenCalledWith(order);
  });

  it('rejects start commands from invalid order states', async () => {
    shippingDetail = Object.assign(new ShippingDetail(), {
      order,
      shipper: shippers.get('shipper-a'),
      status: ShippingStatus.SHIPPING,
    });
    order.status = 'pending';

    await expect(service.startOrder(order.id, 'shipper-a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('delegates completion to the Delivery-owned completion flow', async () => {
    completionService.complete.mockResolvedValue({ message: 'Đơn hàng đã được hoàn thành' });

    await expect(service.markOrderCompleted(order.id, 'shipper-a')).resolves.toEqual({
      message: 'Đơn hàng đã được hoàn thành',
    });
    expect(completionService.complete).toHaveBeenCalledWith(order.id, 'shipper-a');
  });
});
