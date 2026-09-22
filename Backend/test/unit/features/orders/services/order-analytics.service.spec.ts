import { OrderAnalyticsService } from 'src/features/orders/services/order-analytics.service';

describe('OrderAnalyticsService', () => {
  const order = {
    id: 'order-1',
    restaurant: { id: 'restaurant-1' },
    user: { id: 'customer-1' },
    shippingDetail: {
      shipper: { id: 'shipper-1' },
      actualDeliveryTime: new Date('2026-09-20T10:00:00.000Z'),
    },
    total: 50_000,
    status: 'completed',
    createdAt: new Date('2026-09-20T09:00:00.000Z'),
  };

  it('returns null when the order does not exist', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new OrderAnalyticsService(repository as never);

    await expect(service.getOrderData('missing-order')).resolves.toBeNull();
  });

  it('returns only the order data needed by Analytics', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(order) };
    const service = new OrderAnalyticsService(repository as never);

    await expect(service.getOrderData('order-1')).resolves.toEqual({
      orderId: 'order-1',
      restaurantId: 'restaurant-1',
      customerId: 'customer-1',
      shipperId: 'shipper-1',
      total: 50_000,
      status: 'completed',
      createdAt: order.createdAt,
      deliveryCompletedAt: order.shippingDetail.actualDeliveryTime,
    });
  });

  it('normalizes page limits before querying orders', async () => {
    const repository = { findAndCount: jest.fn().mockResolvedValue([[order], 1]) };
    const service = new OrderAnalyticsService(repository as never);

    await expect(service.listOrderData(0, 1_000)).resolves.toEqual(
      expect.objectContaining({ page: 1, pageSize: 500, totalItems: 1, totalPages: 1 }),
    );
    expect(repository.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 500 }),
    );
  });
});
