import { ConflictException, ForbiddenException } from '@nestjs/common';
import { OrderReviewEligibilityService } from 'src/features/orders/services/order-cross-feature.adapters';

describe('OrderReviewEligibilityService', () => {
  const completedOrder = {
    id: 'order-1',
    status: 'completed',
    orderDetails: [{ food: { id: 'food-1' } }, { food: { id: 'food-2' } }],
    shippingDetail: { shipper: { id: 'shipper-1' } },
  };

  it('keeps food-review permission inside Orders', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(completedOrder),
    };
    const service = new OrderReviewEligibilityService(repository as never);

    await expect(
      service.assertCustomerCanReviewFood({
        orderId: 'order-1',
        customerId: 'customer-1',
        foodId: 'food-1',
      }),
    ).resolves.toBeUndefined();
    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', user: { id: 'customer-1' } } }),
    );
  });

  it('rejects a food that was not purchased without returning order data', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(completedOrder) };
    const service = new OrderReviewEligibilityService(repository as never);

    await expect(
      service.assertCustomerCanReviewFood({
        orderId: 'order-1',
        customerId: 'customer-1',
        foodId: 'food-other',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a review when the owned order is not completed', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({ ...completedOrder, status: 'delivering' }),
    };
    const service = new OrderReviewEligibilityService(repository as never);

    await expect(
      service.assertCustomerCanReviewShipper({
        orderId: 'order-1',
        customerId: 'customer-1',
        shipperId: 'shipper-1',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects a shipper who did not deliver the order', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(completedOrder) };
    const service = new OrderReviewEligibilityService(repository as never);

    await expect(
      service.assertCustomerCanReviewShipper({
        orderId: 'order-1',
        customerId: 'customer-1',
        shipperId: 'shipper-other',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not reveal an order not owned by the current customer', async () => {
    const repository = { findOne: jest.fn().mockResolvedValue(null) };
    const service = new OrderReviewEligibilityService(repository as never);

    await expect(
      service.assertCustomerCanReviewFood({
        orderId: 'order-1',
        customerId: 'customer-other',
        foodId: 'food-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
