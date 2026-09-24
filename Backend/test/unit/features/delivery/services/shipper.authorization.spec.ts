import { ForbiddenException } from '@nestjs/common';
import { ShipperDeliveryService } from 'src/features/delivery/services/shipper-delivery.service';

describe('Shipper assignment authorization characterization', () => {
  let pendingAssignmentService: {
    getPendingAssignmentForShipper: jest.Mock;
    assignOrderToShipper: jest.Mock;
  };
  let service: ShipperDeliveryService;

  beforeEach(() => {
    pendingAssignmentService = {
      getPendingAssignmentForShipper: jest.fn(),
      assignOrderToShipper: jest.fn(),
    };
    service = createService(pendingAssignmentService);
  });

  it('returns 403 when a shipper accepts an order without an active offer', async () => {
    pendingAssignmentService.assignOrderToShipper = jest
      .fn()
      .mockRejectedValue(new ForbiddenException());
    await expect(service.assignOrderToShipper('order-1', 'shipper-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns 403 when a different shipper completes an assigned order', async () => {
    const completion = { complete: jest.fn().mockRejectedValue(new ForbiddenException()) };
    service = createService(pendingAssignmentService, completion);

    await expect(service.markOrderCompleted('order-1', 'shipper-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(completion.complete).toHaveBeenCalledWith('order-1', 'shipper-a');
  });
});

function createService(
  pending: { getPendingAssignmentForShipper: jest.Mock; assignOrderToShipper: jest.Mock },
  completion: { complete: jest.Mock } = { complete: jest.fn() },
): ShipperDeliveryService {
  return new ShipperDeliveryService(
    { findOne: jest.fn() } as never,
    { findOne: jest.fn() } as never,
    pending as never,
    completion as never,
    {
      startDelivery: jest.fn(),
      cancelDelivery: jest.fn(),
      getShipperOrder: jest.fn(),
      getShipperOrders: jest.fn(),
    } as never,
  );
}
