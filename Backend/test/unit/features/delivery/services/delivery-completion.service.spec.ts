import { ForbiddenException } from '@nestjs/common';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { DeliveryCompletionService } from 'src/features/delivery/services/shipper/delivery-completion.service';

describe('DeliveryCompletionService', () => {
  let shippingDetail: ShippingDetail;
  let shipper: { id: string };
  let shippingRepository: Record<string, jest.Mock | { transaction: jest.Mock }>;
  let shipperProfileRepository: Record<string, jest.Mock>;
  let outbox: Record<string, jest.Mock>;

  type RepositoryStub = Record<string, jest.Mock | { transaction: jest.Mock }>;
  type TransactionManager = { getRepository(entity: unknown): RepositoryStub };

  beforeEach(() => {
    shipper = { id: 'shipper-1' };
    shippingDetail = Object.assign(new ShippingDetail(), {
      id: 'shipping-1',
      shipper,
      status: ShippingStatus.SHIPPING,
      estimatedDeliveryTime: new Date(Date.now() + 10 * 60_000),
    });
    shipperProfileRepository = {
      findOne: jest.fn().mockResolvedValue({ userId: shipper.id, completedDeliveries: 4 }),
    };
    shippingRepository = {
      findOne: jest.fn().mockResolvedValue(shippingDetail),
      save: jest.fn().mockResolvedValue(shippingDetail),
      manager: {
        transaction: jest.fn((callback: (manager: TransactionManager) => unknown) =>
          callback({
            getRepository: ((entity: unknown) =>
              entity === ShippingDetail
                ? shippingRepository
                : shipperProfileRepository) as TransactionManager['getRepository'],
          }),
        ),
      },
    };
    outbox = {
      enqueue: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
      dispatchAfterCommit: jest.fn().mockResolvedValue(undefined),
    };
  });

  const createService = (status = 'delivering') => {
    const orderReader = {
      findForCompletion: jest.fn().mockResolvedValue({
        orderId: 'order-1',
        status,
        shippingFee: 25_000,
        deliveryDistance: 2,
        total: 100_000,
        estimatedDeliveryTime: 30,
        shipperEarnings: null,
      }),
    };
    return {
      service: new DeliveryCompletionService(
        shippingRepository as never,
        shipperProfileRepository as never,
        orderReader as never,
        outbox as never,
      ),
      orderReader,
    };
  };

  it('settles Delivery data and stores the Orders completion event in the same transaction', async () => {
    const { service, orderReader } = createService();

    const result = await service.complete('order-1', shipper.id);

    expect(result.earnings).toBeGreaterThan(0);
    expect(orderReader.findForCompletion).toHaveBeenCalledWith('order-1');
    expect(shippingDetail.status).toBe(ShippingStatus.COMPLETED);
    expect(shippingRepository.save).toHaveBeenCalledWith(shippingDetail);
    expect(outbox.enqueue).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'delivery.completed',
        aggregateId: 'order-1',
        idempotencyKey: 'delivery-completed:order-1',
      }),
    );
    expect(outbox.dispatchAfterCommit).toHaveBeenCalledWith('outbox-1');
  });

  it('does not settle an order for another shipper', async () => {
    const { service } = createService();

    await expect(service.complete('order-1', 'shipper-2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });

  it('refuses to complete when Orders no longer reports a delivering order', async () => {
    const { service } = createService('canceled');

    await expect(service.complete('order-1', shipper.id)).rejects.toThrow(
      'Order must be delivering before completion',
    );
    expect(outbox.enqueue).not.toHaveBeenCalled();
  });
});
