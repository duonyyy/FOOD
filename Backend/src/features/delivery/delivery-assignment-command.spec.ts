import { DeliveryAssignmentCommandService } from './services/delivery-assignment-command.service';

describe('DeliveryAssignmentCommandService', () => {
  it('checks ownership and expiry before accepting', async () => {
    const legacy = {
      getPendingAssignmentForShipper: jest.fn().mockResolvedValue({
        assignmentId: 'a-1',
        orderId: 'order-1',
        shipperId: 'shipper-a',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      acceptAssignment: jest.fn().mockResolvedValue({ id: 'shipping-1' }),
    };
    const service = new DeliveryAssignmentCommandService(legacy as never);

    await expect(
      service.acceptDelivery({ assignmentId: 'a-1', actorId: 'shipper-a' }),
    ).resolves.toEqual({ id: 'shipping-1' });
    expect(legacy.acceptAssignment).toHaveBeenCalledWith('a-1', 'shipper-a');
  });

  it('does not call the legacy command for another shipper', async () => {
    const legacy = {
      getPendingAssignmentForShipper: jest.fn().mockResolvedValue({
        assignmentId: 'a-1',
        orderId: 'order-1',
        shipperId: 'shipper-a',
        expiresAt: new Date(Date.now() + 60_000),
      }),
      acceptAssignment: jest.fn(),
    };
    const service = new DeliveryAssignmentCommandService(legacy as never);

    await expect(
      service.acceptDelivery({ assignmentId: 'a-1', actorId: 'shipper-b' }),
    ).rejects.toThrow('This assignment does not belong to you');
    expect(legacy.acceptAssignment).not.toHaveBeenCalled();
  });

  it('allows admin reassign and rejects unrelated actors', async () => {
    const legacy = {
      getPendingAssignmentForOrder: jest.fn().mockResolvedValue({ shipperId: 'shipper-a' }),
      reassignOrder: jest.fn().mockResolvedValue({ message: 'Order queued for reassignment' }),
    };
    const service = new DeliveryAssignmentCommandService(legacy as never);

    await expect(
      service.reassignDelivery({ orderId: 'order-1', actorId: 'admin-1', actorRole: 'admin' }),
    ).resolves.toEqual({ message: 'Order queued for reassignment' });
    await expect(
      service.reassignDelivery({ orderId: 'order-1', actorId: 'shipper-b' }),
    ).rejects.toThrow('Only the assigned shipper or an admin can reassign');
  });
});
