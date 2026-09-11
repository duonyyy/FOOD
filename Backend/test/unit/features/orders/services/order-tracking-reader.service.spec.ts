import { OrderTrackingReaderService } from 'src/features/orders/services/order-tracking-reader.service';

describe('OrderTrackingReaderService', () => {
  const orderRepository = { findOne: jest.fn() };
  const service = new OrderTrackingReaderService(orderRepository as never);

  beforeEach(() => jest.clearAllMocks());

  it('queries by both order and JWT customer IDs', async () => {
    orderRepository.findOne.mockResolvedValue({ id: 'order-a' });

    await expect(service.findCustomerOrderForTracking('order-a', 'customer-a')).resolves.toEqual({
      orderId: 'order-a',
    });
    expect(orderRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'order-a', user: { id: 'customer-a' } },
    });
  });

  it('does not reveal whether an order exists when it is not owned by the customer', async () => {
    orderRepository.findOne.mockResolvedValue(null);

    await expect(service.findCustomerOrderForTracking('order-a', 'customer-b')).resolves.toBeNull();
  });
});
