import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { CustomerDeliveryController } from 'src/features/delivery/controllers/customer-delivery.controller';
import {
  AuthGuard,
  CurrentActor,
  type CurrentActor as CurrentActorData,
} from 'src/features/users/public-api';

describe('CustomerDeliveryController', () => {
  const orderTrackingReader = {
    findCustomerOrderForTracking: jest.fn(),
  };
  const deliveryIntegrationService = {
    getDeliveryTracking: jest.fn(),
  };
  const controller = new CustomerDeliveryController(
    orderTrackingReader as never,
    deliveryIntegrationService as never,
  );

  beforeEach(() => jest.clearAllMocks());

  it('allows the JWT customer to track their order and removes shipper phone', async () => {
    orderTrackingReader.findCustomerOrderForTracking.mockResolvedValue({ orderId: 'order-a' });
    deliveryIntegrationService.getDeliveryTracking.mockResolvedValue({
      orderId: 'order-a',
      trackingStatus: 'SHIPPING',
      shipper: { id: 'shipper-a', name: 'Shipper A', phone: '0900000000', rating: 4.8 },
    });
    const actor: CurrentActorData = { userId: 'customer-a' };

    const result = await controller.trackOrder('order-a', actor);

    expect(orderTrackingReader.findCustomerOrderForTracking).toHaveBeenCalledWith(
      'order-a',
      'customer-a',
    );
    expect(deliveryIntegrationService.getDeliveryTracking).toHaveBeenCalledWith('order-a');
    expect(result).toMatchObject({
      orderId: 'order-a',
      shipper: { id: 'shipper-a', name: 'Shipper A', rating: 4.8 },
    });
    expect(result.shipper).not.toHaveProperty('phone');
  });

  it('returns the same 404 for another customer and does not load tracking details', async () => {
    orderTrackingReader.findCustomerOrderForTracking.mockResolvedValue(null);

    await expect(controller.trackOrder('order-a', { userId: 'customer-b' })).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(orderTrackingReader.findCustomerOrderForTracking).toHaveBeenCalledWith(
      'order-a',
      'customer-b',
    );
    expect(deliveryIntegrationService.getDeliveryTracking).not.toHaveBeenCalled();
  });

  it('requires authenticated access and derives the actor through CurrentActor', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, CustomerDeliveryController) as unknown[];
    expect(guards).toContain(AuthGuard);
    expect(CurrentActor).toBeDefined();
  });
});
