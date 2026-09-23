import { OrderDeliveryService } from 'src/features/orders/services/order-delivery.service';

describe('OrderDeliveryService dispatch data', () => {
  it('returns only dispatch data for a confirmed order', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'order-1',
        shippingFee: 20_000,
        shipperEarnings: null,
        deliveryDistance: 3.5,
        shipperCommissionRate: 0.8,
        estimatedDeliveryTime: 35,
        restaurant: { latitude: '10.77', longitude: '106.7' },
      }),
    };
    const service = new OrderDeliveryService(repository as never, {} as never, {} as never);

    await expect(service.findConfirmedDispatchCandidate('order-1')).resolves.toEqual({
      orderId: 'order-1',
      restaurantLocation: { latitude: 10.77, longitude: 106.7 },
      shippingFee: 20_000,
      shipperEarnings: null,
      deliveryDistance: 3.5,
      shipperCommissionRate: 0.8,
      estimatedDeliveryTime: 35,
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'order-1', status: 'confirmed' },
      relations: ['restaurant'],
    });
  });

  it('lists only confirmed order IDs for Delivery to reconcile', async () => {
    const repository = {
      find: jest.fn().mockResolvedValue([{ id: 'order-1' }, { id: 'order-2' }]),
    };
    const service = new OrderDeliveryService(repository as never, {} as never, {} as never);

    await expect(service.listConfirmedOrderIds(1_000)).resolves.toEqual(['order-1', 'order-2']);

    expect(repository.find).toHaveBeenCalledWith({
      select: { id: true },
      where: { status: 'confirmed' },
      order: { createdAt: 'ASC' },
      take: 500,
    });
  });
});
