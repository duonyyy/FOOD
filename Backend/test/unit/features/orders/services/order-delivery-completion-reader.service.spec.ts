import { OrderDeliveryService } from 'src/features/orders/services/order-delivery.service';

describe('OrderDeliveryService completion data', () => {
  it('includes the customer snapshot required by Delivery completion events', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'order-1',
        user: { id: 'customer-1' },
        status: 'delivering',
        shippingFee: 20_000,
        deliveryDistance: 3,
        total: 100_000,
        estimatedDeliveryTime: 30,
        shipperEarnings: null,
      }),
    };
    const service = new OrderDeliveryService(repository as never, {} as never, {} as never);

    await expect(service.findForCompletion('order-1')).resolves.toEqual({
      orderId: 'order-1',
      customerId: 'customer-1',
      status: 'delivering',
      shippingFee: 20_000,
      deliveryDistance: 3,
      total: 100_000,
      estimatedDeliveryTime: 30,
      shipperEarnings: null,
    });
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      relations: ['user'],
    });
  });
});
