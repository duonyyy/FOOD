import { BadRequestException } from '@nestjs/common';
import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { ShipperService } from 'src/features/delivery/services/shipper/shipper.service';
import { SHIPPER_PROFILE_STATUS } from 'src/features/delivery/types/shipper-profile.types';

describe('Shipper delivery boundary baseline', () => {
  let shippingDetail: ShippingDetail | null;
  let profile: ShipperProfile;
  let shippingRepository: Record<string, jest.Mock>;
  let profileRepository: Record<string, jest.Mock>;
  let pending: Record<string, jest.Mock>;
  let assignmentSaga: { assign: jest.Mock };
  let lifecycle: { startDelivery: jest.Mock; cancelDelivery: jest.Mock };
  let reader: { getShipperOrder: jest.Mock; getShipperOrders: jest.Mock };
  let completionService: { complete: jest.Mock };
  let service: ShipperService;

  beforeEach(() => {
    shippingDetail = null;
    profile = Object.assign(new ShipperProfile(), {
      userId: 'shipper-a',
      certificateStatus: SHIPPER_PROFILE_STATUS.APPROVED,
      isAvailable: true,
      activeDeliveries: 0,
      maxActiveDeliveries: 3,
      completedDeliveries: 0,
      rejectedOrders: 0,
      failedDeliveries: 0,
      responseTimeMinutes: 0,
    });
    shippingRepository = {
      findOne: jest.fn(() => Promise.resolve(shippingDetail)),
      find: jest.fn(() => Promise.resolve([])),
      save: jest.fn((value: ShippingDetail) => Promise.resolve(value)),
    };
    profileRepository = {
      findOne: jest.fn(() => Promise.resolve(profile)),
      save: jest.fn((value: ShipperProfile) => Promise.resolve(value)),
    };
    pending = {
      addPendingAssignment: jest.fn().mockResolvedValue({ id: 'pending-1' }),
      getPendingAssignmentForShipper: jest.fn((shipperId: string) =>
        Promise.resolve({
          assignmentId: `assignment-${shipperId}`,
          orderId: 'order-1',
          shipperId,
          expiresAt: new Date(Date.now() + 60_000),
        }),
      ),
      getActiveHoldForOrder: jest.fn().mockResolvedValue(null),
      getPendingAssignmentForOrder: jest.fn().mockResolvedValue(null),
      createShipperHold: jest.fn().mockResolvedValue({
        assignmentId: 'assignment-1',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      markOfferRejected: jest.fn().mockResolvedValue(undefined),
      removePendingAssignment: jest.fn().mockResolvedValue(undefined),
    };
    assignmentSaga = { assign: jest.fn() };
    lifecycle = {
      startDelivery: jest.fn().mockResolvedValue({ orderId: 'order-1', status: 'delivering' }),
      cancelDelivery: jest.fn().mockResolvedValue({ orderId: 'order-1', status: 'canceled' }),
    };
    reader = {
      getShipperOrder: jest.fn().mockResolvedValue({ id: 'order-1', status: 'shipper_received' }),
      getShipperOrders: jest.fn().mockResolvedValue(new Map()),
    };
    completionService = { complete: jest.fn() };
    service = new ShipperService(
      shippingRepository as never,
      profileRepository as never,
      pending as never,
      assignmentSaga as never,
      completionService as never,
      { ...lifecycle, ...reader } as never,
      {} as never,
      {} as never,
    );
  });

  it('creates an offer after Delivery validates the shipper profile and dispatch candidate', async () => {
    pending.getPendingAssignmentForShipper.mockResolvedValueOnce(null);
    const result = await service.requestOrderAssignment('order-1', 'shipper-a');

    expect(pending.addPendingAssignment).toHaveBeenCalledWith('order-1');
    expect(pending.createShipperHold).toHaveBeenCalledWith('order-1', 'shipper-a');
    expect(result.assignmentId).toBe('assignment-1');
  });

  it('delegates accepted offers to the durable Delivery assignment saga', async () => {
    const detail = Object.assign(new ShippingDetail(), {
      id: 'shipping-1',
      status: ShippingStatus.SHIPPING,
    });
    assignmentSaga.assign.mockResolvedValue(detail);

    await expect(service.assignOrderToShipper('order-1', 'shipper-a', 90)).resolves.toBe(detail);
    expect(assignmentSaga.assign).toHaveBeenCalledWith('order-1', 'shipper-a', 90);
  });

  it('requeues a rejection through Delivery dispatch instead of publishing a raw Order', async () => {
    await service.reassignOrder('order-1');
    expect(pending.addPendingAssignment).toHaveBeenCalledWith('order-1');
  });

  it('rejects expired offers through the pending-assignment retry path', async () => {
    pending.getPendingAssignmentForShipper.mockResolvedValueOnce({
      assignmentId: 'expired-assignment',
      orderId: 'order-1',
      shipperId: 'shipper-a',
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(
      service.acceptAssignment('expired-assignment', 'shipper-a'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(pending.markOfferRejected).toHaveBeenCalledWith('order-1', 'shipper-a');
  });

  it('records rejection in the Delivery-owned profile', async () => {
    await service.rejectOrder('order-1', 'shipper-a', 20);
    expect(pending.markOfferRejected).toHaveBeenCalledWith('order-1', 'shipper-a');
    expect(profile.rejectedOrders).toBe(1);
    expect(profileRepository.save).toHaveBeenCalledWith(profile);
  });

  it('reads the order through the Orders read API after checking trip ownership', async () => {
    shippingDetail = Object.assign(new ShippingDetail(), {
      id: 'shipping-1',
      status: ShippingStatus.SHIPPING,
    });
    await expect(service.getOrder('order-1', 'shipper-a')).resolves.toEqual({
      id: 'order-1',
      status: 'shipper_received',
    });
    expect(reader.getShipperOrder).toHaveBeenCalledWith('order-1');
  });

  it('asks Orders to start delivery after Delivery checks trip ownership', async () => {
    shippingDetail = Object.assign(new ShippingDetail(), {
      id: 'shipping-1',
      status: ShippingStatus.SHIPPING,
    });
    await expect(service.startOrder('order-1', 'shipper-a')).resolves.toEqual({
      orderId: 'order-1',
      status: 'delivering',
    });
    expect(lifecycle.startDelivery).toHaveBeenCalledWith('order-1');
  });

  it('delegates completion to the Delivery-owned completion flow', async () => {
    completionService.complete.mockResolvedValue({ message: 'Đơn hàng đã được hoàn thành' });
    await expect(service.markOrderCompleted('order-1', 'shipper-a')).resolves.toEqual({
      message: 'Đơn hàng đã được hoàn thành',
    });
  });
});
