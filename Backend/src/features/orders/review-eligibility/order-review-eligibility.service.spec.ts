import { OrderReviewEligibilityService } from './order-review-eligibility.service';

describe('OrderReviewEligibilityService', () => {
  it('returns only scalar review eligibility data for the current order customer', async () => {
    const repository = {
      findOne: jest.fn().mockResolvedValue({
        id: 'order-1',
        user: { id: 'customer-1' },
        status: 'completed',
        orderDetails: [{ food: { id: 'food-1' } }, { food: { id: 'food-2' } }],
        shippingDetail: { shipper: { id: 'shipper-1' } },
      }),
    };
    const service = new OrderReviewEligibilityService(repository as never);

    await expect(
      service.findReviewEligibility({ orderId: 'order-1', customerId: 'customer-1' }),
    ).resolves.toEqual({
      orderId: 'order-1',
      customerId: 'customer-1',
      orderStatus: 'completed',
      foodIds: ['food-1', 'food-2'],
      shipperId: 'shipper-1',
    });
    expect(repository.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order-1', user: { id: 'customer-1' } } }),
    );
  });
});
