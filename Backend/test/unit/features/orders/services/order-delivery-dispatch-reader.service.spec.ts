import { OrderDeliveryDispatchReaderService } from 'src/features/orders/services/order-delivery-dispatch-reader.service';

describe('OrderDeliveryDispatchReaderService', () => {
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
    const service = new OrderDeliveryDispatchReaderService(repository as never);

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
});
