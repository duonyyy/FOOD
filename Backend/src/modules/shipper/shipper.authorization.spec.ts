import { ForbiddenException } from '@nestjs/common';
import { ShipperService } from './shipper.service';

describe('Shipper assignment authorization characterization', () => {
  let orderRepository: { findOne: jest.Mock; manager: { transaction: jest.Mock } };
  let shippingDetailRepository: { findOne: jest.Mock };
  let pendingAssignmentService: { getPendingAssignmentForShipper: jest.Mock };
  let service: ShipperService;

  beforeEach(() => {
    orderRepository = {
      findOne: jest.fn(),
      manager: {
        transaction: jest.fn(async (callback) =>
          callback({
            getRepository: (entity: { name: string }) =>
              entity.name === 'Order'
                ? orderRepository
                : entity.name === 'ShippingDetail'
                  ? shippingDetailRepository
                  : {},
          }),
        ),
      },
    };
    shippingDetailRepository = { findOne: jest.fn() };
    pendingAssignmentService = { getPendingAssignmentForShipper: jest.fn() };
    service = new ShipperService(
      orderRepository as never,
      shippingDetailRepository as never,
      {} as never,
      {} as never,
      pendingAssignmentService as never,
    );
  });

  it('returns 403 when a shipper accepts an order without an active offer', async () => {
    pendingAssignmentService.getPendingAssignmentForShipper.mockResolvedValue(null);

    await expect(service.assignOrderToShipper('order-1', 'shipper-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(orderRepository.findOne).not.toHaveBeenCalled();
  });

  it('returns 403 when a different shipper completes an assigned order', async () => {
    orderRepository.findOne.mockResolvedValue({ id: 'order-1', status: 'delivering' });
    shippingDetailRepository.findOne.mockResolvedValue({
      order: { id: 'order-1' },
      shipper: { id: 'shipper-b' },
    });

    await expect(service.markOrderCompleted('order-1', 'shipper-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
