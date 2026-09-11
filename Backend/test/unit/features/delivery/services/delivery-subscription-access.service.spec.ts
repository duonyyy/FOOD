import { ShippingStatus } from 'src/entities/shippingDetail.entity';
import { DeliverySubscriptionAccessService } from 'src/features/delivery/services/subscription/delivery-subscription-access.service';

describe('DeliverySubscriptionAccessService', () => {
  const shippingDetailRepository = { findOne: jest.fn() };
  const service = new DeliverySubscriptionAccessService(shippingDetailRepository as never);

  beforeEach(() => jest.clearAllMocks());

  it('allows a shipper to subscribe only to their own location', async () => {
    await expect(service.canAccessShipperLocation('shipper-a', 'shipper-a')).resolves.toBe(true);
    expect(shippingDetailRepository.findOne).not.toHaveBeenCalled();
  });

  it('allows a customer only while an active delivery links them to the shipper', async () => {
    shippingDetailRepository.findOne.mockResolvedValue({ id: 'delivery-a' });

    await expect(service.canAccessShipperLocation('customer-a', 'shipper-a')).resolves.toBe(true);
    expect(shippingDetailRepository.findOne).toHaveBeenCalledWith({
      where: {
        shipper: { id: 'shipper-a' },
        order: { user: { id: 'customer-a' } },
        status: ShippingStatus.SHIPPING,
      },
    });
  });

  it('does not reveal a shipper location to an unrelated customer', async () => {
    shippingDetailRepository.findOne.mockResolvedValue(null);

    await expect(service.canAccessShipperLocation('customer-b', 'shipper-a')).resolves.toBe(false);
  });
});
