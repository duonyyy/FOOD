import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrderCoreService } from 'src/features/orders/services/order-core.service';

describe('Order messaging authorization', () => {
  const repository = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const service = new OrderCoreService(repository as never);

  beforeEach(() => jest.clearAllMocks());

  it('hides an order that does not belong to the customer', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.assertCustomerCanChatWithShipper({
        orderId: 'order-1',
        customerId: 'customer-other',
        shipperId: 'shipper-1',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects a shipper who is not assigned to the order', async () => {
    repository.findOne.mockResolvedValue({
      id: 'order-1',
      status: 'delivering',
      shippingDetail: { shipper: { id: 'shipper-other' } },
    });

    await expect(
      service.assertCustomerCanChatWithShipper({
        orderId: 'order-1',
        customerId: 'customer-1',
        shipperId: 'shipper-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows the assigned shipper while the order is open for messaging', async () => {
    repository.findOne.mockResolvedValue({
      id: 'order-1',
      status: 'delivering',
      shippingDetail: { shipper: { id: 'shipper-1' } },
    });

    await expect(
      service.assertCustomerCanChatWithShipper({
        orderId: 'order-1',
        customerId: 'customer-1',
        shipperId: 'shipper-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('treats a missing order as closed for an existing conversation', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(service.isOrderOpenForShipperMessaging('missing-order')).resolves.toBe(false);
  });
});
