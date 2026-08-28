import { BadRequestException, ConflictException } from '@nestjs/common';
import { Order } from 'src/entities/order.entity';
import { DefaultRole } from 'src/entities/role.entity';
import { CertificateStatus } from 'src/entities/shipperCertificateInfo.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { pubSub } from 'src/pubsub';
import { ShipperService } from './shipper.service';

jest.mock('src/pubsub', () => ({ pubSub: { publish: jest.fn().mockResolvedValue(true) } }));

describe('Shipper delivery transition and concurrency baseline', () => {
  let order: Order;
  let shippingDetail: ShippingDetail | null;
  let shippers: Map<string, User>;
  let orderRepository: Record<string, jest.Mock | object>;
  let shippingRepository: Record<string, jest.Mock>;
  let userRepository: Record<string, jest.Mock>;
  let pending: Record<string, jest.Mock>;
  let outbox: Record<string, jest.Mock>;
  let service: ShipperService;

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
      findOne: jest.fn(async () => shippingDetail),
      create: jest.fn((value) => Object.assign(new ShippingDetail(), value)),
      save: jest.fn(async (value) => {
        shippingDetail = value;
        return value;
      }),
    };
    userRepository = {
      findOne: jest.fn(async ({ where }) => shippers.get(where.id) || null),
      save: jest.fn(async (value) => value),
    };

    let transactionTail = Promise.resolve();
    const manager = {
      getRepository: (entity: { name: string }) => {
        if (entity === Order) return orderRepository;
        if (entity === ShippingDetail) return shippingRepository;
        if (entity === User) return userRepository;
        throw new Error(`Unexpected repository ${entity.name}`);
      },
    };
    orderRepository = {
      findOne: jest.fn(async () => order),
      save: jest.fn(async (value) => value),
      manager: {
        transaction: jest.fn((callback) => {
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
      getPendingAssignmentForShipper: jest.fn(async (shipperId) => ({
        assignmentId: `assignment-${shipperId}`,
        orderId: order.id,
        shipperId,
        expiresAt: new Date(Date.now() + 60_000),
      })),
      getActiveHoldForOrder: jest.fn().mockResolvedValue(null),
      createShipperHold: jest.fn().mockResolvedValue({
        assignmentId: 'assignment-1',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      markOfferRejected: jest.fn().mockResolvedValue(undefined),
      removePendingAssignment: jest.fn().mockResolvedValue(undefined),
    };
    outbox = {
      enqueue: jest.fn().mockResolvedValue({ id: 'outbox-delivery-completed-1' }),
      dispatchAfterCommit: jest.fn().mockResolvedValue(undefined),
    };
    service = new ShipperService(
      orderRepository as never,
      shippingRepository as never,
      userRepository as never,
      {} as never,
      pending as never,
      outbox as never,
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
      reason: expect.any(ConflictException),
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

  it('rejects start and complete commands from invalid order states', async () => {
    shippingDetail = Object.assign(new ShippingDetail(), {
      order,
      shipper: shippers.get('shipper-a'),
      status: ShippingStatus.SHIPPING,
    });
    order.status = 'pending';

    await expect(service.startOrder(order.id, 'shipper-a')).rejects.toBeInstanceOf(
      BadRequestException,
    );

    order.status = 'shipper_received';
    await expect(service.markOrderCompleted(order.id, 'shipper-a')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('completes and credits earnings once across concurrent retry', async () => {
    order.status = 'delivering';
    shippingDetail = Object.assign(new ShippingDetail(), {
      order,
      shipper: shippers.get('shipper-a'),
      status: ShippingStatus.SHIPPING,
      estimatedDeliveryTime: new Date(Date.now() + 10 * 60_000),
    });

    const results = await Promise.all([
      service.markOrderCompleted(order.id, 'shipper-a'),
      service.markOrderCompleted(order.id, 'shipper-a'),
    ]);

    expect(results[0].earnings).toBeGreaterThan(0);
    expect(results[1].earnings).toBe(results[0].earnings);
    expect(userRepository.save).toHaveBeenCalledTimes(1);
    expect(shippers.get('shipper-a')?.completedDeliveries).toBe(1);
    expect(shippers.get('shipper-a')?.totalEarnings).toBe(results[0].earnings);
  });

  it('enqueues and dispatches DeliveryCompleted only after the completion transaction', async () => {
    order.status = 'delivering';
    shippingDetail = Object.assign(new ShippingDetail(), {
      id: 'shipping-1',
      order,
      shipper: shippers.get('shipper-a'),
      status: ShippingStatus.SHIPPING,
      estimatedDeliveryTime: new Date(Date.now() + 10 * 60_000),
    });

    await service.markOrderCompleted(order.id, 'shipper-a');

    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'delivery.completed',
        idempotencyKey: `delivery-completed:${order.id}`,
      }),
    );
    expect(outbox.dispatchAfterCommit).toHaveBeenCalledWith('outbox-delivery-completed-1');
  });
});
