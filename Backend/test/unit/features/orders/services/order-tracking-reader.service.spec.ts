import { NotFoundException } from '@nestjs/common';
import { OrderDeliveryService } from 'src/features/orders/services/order-delivery.service';

describe('OrderDeliveryService tracking policy', () => {
  const orderRepository = { findOne: jest.fn() };
  const service = new OrderDeliveryService(orderRepository as never, {} as never, {} as never);

  beforeEach(() => jest.clearAllMocks());

  it('queries by both order and JWT customer IDs', async () => {
    orderRepository.findOne.mockResolvedValue({ id: 'order-a' });

    await expect(
      service.assertCustomerCanTrackOrder('order-a', 'customer-a'),
    ).resolves.toBeUndefined();
    expect(orderRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'order-a', user: { id: 'customer-a' } },
    });
  });

  it('does not reveal whether an order exists when it is not owned by the customer', async () => {
    orderRepository.findOne.mockResolvedValue(null);

    await expect(
      service.assertCustomerCanTrackOrder('order-a', 'customer-b'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
