import { NotFoundException } from '@nestjs/common';
import { ShippingStatus } from 'src/entities/shippingDetail.entity';
import { CustomerDeliveryService } from 'src/features/delivery/services/customer-delivery.service';

describe('CustomerDeliveryService - tracking and subscription access', () => {
  const shippingDetailRepository = { findOne: jest.fn() };
  const orderDelivery = { assertCustomerCanTrackOrder: jest.fn() };
  const service = new CustomerDeliveryService(
    shippingDetailRepository as never,
    orderDelivery as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('checks order ownership before loading tracking or shipper data', async () => {
    orderDelivery.assertCustomerCanTrackOrder.mockRejectedValueOnce(
      new NotFoundException('Delivery tracking not found'),
    );
    await expect(service.getDeliveryTracking('order-a', 'customer-b')).rejects.toThrow(
      NotFoundException,
    );
    expect(orderDelivery.assertCustomerCanTrackOrder).toHaveBeenCalledWith('order-a', 'customer-b');
    expect(shippingDetailRepository.findOne).not.toHaveBeenCalled();
  });

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
