import { ForbiddenException } from '@nestjs/common';
import { ShippingStatus } from 'src/entities/shippingDetail.entity';
import { DeliveryDispatchService } from 'src/features/delivery/services/dispatch/delivery-dispatch.service';

describe('Delivery dispatch commands', () => {
  const profileRepository = { findOne: jest.fn() };
  const saga = { assign: jest.fn() };
  const store = { removeByOrderId: jest.fn() };
  let service: DeliveryDispatchService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DeliveryDispatchService(
      {} as never,
      {} as never,
      {} as never,
      store as never,
      profileRepository as never,
      {} as never,
      {} as never,
      saga as never,
    );
  });

  it('creates a hold only for an approved and available shipper', async () => {
    jest.spyOn(service, 'getPendingAssignmentForShipper').mockResolvedValue(null);
    jest.spyOn(service, 'getActiveHoldForOrder').mockResolvedValue(null);
    const addPending = jest.spyOn(service, 'addPendingAssignment').mockResolvedValue({} as never);
    const hold = {
      assignmentId: 'assignment-1',
      orderId: 'order-1',
      shipperId: 'shipper-a',
      expiresAt: new Date(Date.now() + 60_000),
    };
    jest.spyOn(service, 'createShipperHold').mockResolvedValue(hold);
    profileRepository.findOne.mockResolvedValue({
      certificateStatus: 'APPROVED',
      isAvailable: true,
      activeDeliveries: 0,
      maxActiveDeliveries: 1,
    });

    await expect(
      service.offerDelivery({ orderId: 'order-1', actorId: 'shipper-a' }),
    ).resolves.toEqual(expect.objectContaining({ assignmentId: 'assignment-1' }));
    expect(addPending).toHaveBeenCalledWith('order-1');

    profileRepository.findOne.mockResolvedValue({
      certificateStatus: 'PENDING',
      isAvailable: true,
      activeDeliveries: 0,
      maxActiveDeliveries: 1,
    });
    await expect(
      service.offerDelivery({ orderId: 'order-1', actorId: 'shipper-a' }),
    ).rejects.toThrow('Invalid or unapproved shipper');
    expect(addPending).toHaveBeenCalledTimes(1);
  });

  it('rejects an assignment owned by another shipper before calling the saga', async () => {
    jest.spyOn(service, 'getPendingAssignmentForShipper').mockResolvedValue({
      assignmentId: 'assignment-1',
      orderId: 'order-1',
      shipperId: 'shipper-a',
      expiresAt: new Date(Date.now() + 60_000),
    });

    await expect(
      service.acceptDelivery({ assignmentId: 'assignment-1', actorId: 'shipper-b' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(saga.assign).not.toHaveBeenCalled();
  });

  it('requeues an expired hold before rejecting acceptance', async () => {
    jest.spyOn(service, 'getPendingAssignmentForShipper').mockResolvedValue({
      assignmentId: 'assignment-1',
      orderId: 'order-1',
      shipperId: 'shipper-a',
      expiresAt: new Date(Date.now() - 1000),
    });
    const markRejected = jest.spyOn(service, 'markOfferRejected').mockResolvedValue(undefined);

    await expect(
      service.acceptDelivery({ assignmentId: 'assignment-1', actorId: 'shipper-a' }),
    ).rejects.toThrow('Assignment has expired');
    expect(markRejected).toHaveBeenCalledWith('order-1', 'shipper-a');
    expect(saga.assign).not.toHaveBeenCalled();
  });

  it('uses the durable assignment saga only for the shipper holding the order', async () => {
    jest.spyOn(service, 'getPendingAssignmentForShipper').mockResolvedValue({
      assignmentId: 'assignment-1',
      orderId: 'order-1',
      shipperId: 'shipper-a',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const detail = { id: 'shipping-1', status: ShippingStatus.SHIPPING };
    saga.assign.mockResolvedValue(detail);
    store.removeByOrderId.mockResolvedValue(true);

    await expect(service.assignOrderToShipper('order-1', 'shipper-a', 90)).resolves.toBe(detail);
    expect(saga.assign).toHaveBeenCalledWith('order-1', 'shipper-a', 90);
    expect(store.removeByOrderId).toHaveBeenCalledWith('order-1');

    await expect(service.assignOrderToShipper('order-2', 'shipper-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(saga.assign).toHaveBeenCalledTimes(1);
  });

  it('allows admin reassign and rejects unrelated actors', async () => {
    jest.spyOn(service, 'getPendingAssignmentForOrder').mockResolvedValue({
      assignmentId: 'assignment-1',
      orderId: 'order-1',
      shipperId: 'shipper-a',
      expiresAt: new Date(Date.now() + 60_000),
    });
    const markRejected = jest.spyOn(service, 'markOfferRejected').mockResolvedValue(undefined);
    const addPending = jest.spyOn(service, 'addPendingAssignment').mockResolvedValue({} as never);

    await expect(
      service.reassignDelivery({ orderId: 'order-1', actorId: 'admin-1', actorRole: 'admin' }),
    ).resolves.toEqual({ message: 'Order queued for reassignment' });
    expect(markRejected).toHaveBeenCalledWith('order-1', 'shipper-a');
    expect(addPending).toHaveBeenCalledWith('order-1');

    await expect(
      service.reassignDelivery({ orderId: 'order-1', actorId: 'shipper-b' }),
    ).rejects.toThrow('Only the assigned shipper or an admin can reassign');
  });
});
