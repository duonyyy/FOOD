import { AnalyticsProjectionService } from './analytics-projection.service';

describe('AnalyticsProjectionService', () => {
  const snapshot = {
    orderId: 'order-1',
    restaurantId: 'restaurant-1',
    customerId: 'customer-1',
    shipperId: null,
    total: 50_000,
    status: 'pending',
    createdAt: new Date('2026-09-03T00:00:00.000Z'),
    deliveryCompletedAt: null,
  };

  it('uses order_id upsert so a replay has one projection row', async () => {
    const metrics = { upsert: jest.fn().mockResolvedValue(undefined) };
    const reader = {
      findAnalyticsSnapshot: jest.fn().mockResolvedValue(snapshot),
      listAnalyticsSnapshots: jest.fn(),
    };
    const service = new AnalyticsProjectionService(metrics as never, reader);

    await service.projectOrder('order-1');
    await service.projectOrder('order-1');

    expect(metrics.upsert).toHaveBeenCalledTimes(2);
    expect(metrics.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ orderId: 'order-1', total: '50000' }),
      ['orderId'],
    );
  });

  it('creates a missing projection from the read contract before processing a payment event', async () => {
    const metrics = {
      exist: jest.fn().mockResolvedValue(false),
      upsert: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const reader = {
      findAnalyticsSnapshot: jest.fn().mockResolvedValue(snapshot),
      listAnalyticsSnapshots: jest.fn(),
    };
    const service = new AnalyticsProjectionService(metrics as never, reader);

    await expect(service.recordPayment('order-1', 'COMPLETED')).resolves.toBe(true);
    expect(metrics.upsert).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-1' }), [
      'orderId',
    ]);
    expect(metrics.update).toHaveBeenCalledWith(
      { orderId: 'order-1' },
      expect.objectContaining({
        paymentStatus: 'COMPLETED',
        paymentSucceededAt: expect.any(Date) as unknown as Date,
      }),
    );
  });
});
