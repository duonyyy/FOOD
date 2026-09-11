import { AuthenticatedRequest } from 'src/common/auth/authenticated-request';
import { ShipperDeliveryController } from 'src/features/delivery/controllers/shipper-delivery.controller';

describe('ShipperDeliveryController unit tests', () => {
  let shipperDeliveryService: {
    assignOrderToShipper: jest.Mock;
    getOrder: jest.Mock;
    startOrder: jest.Mock;
    markOrderCompleted: jest.Mock;
    cancelOrder: jest.Mock;
    rejectOrder: jest.Mock;
    getPendingAssignmentForShipper: jest.Mock;
    getCompletedOrdersByShipper: jest.Mock;
  };
  let shipperProfileService: {
    getDriverProfile: jest.Mock;
    updateLocation: jest.Mock;
  };
  let deliveryReportService: {
    getIncomeReport: jest.Mock;
    getShipperDashboard: jest.Mock;
    getShipperStats: jest.Mock;
  };
  let controller: ShipperDeliveryController;

  const mockReq = {
    user: { id: 'shipper-1', uid: 'shipper-1', userId: 'shipper-1' },
  } as unknown as AuthenticatedRequest;

  beforeEach(() => {
    shipperDeliveryService = {
      assignOrderToShipper: jest.fn().mockResolvedValue({ id: 'shipping-1' }),
      getOrder: jest.fn().mockResolvedValue({ id: 'order-1' }),
      startOrder: jest.fn().mockResolvedValue({ id: 'order-1', status: 'delivering' }),
      markOrderCompleted: jest.fn().mockResolvedValue({ message: 'Đơn hàng đã được hoàn thành' }),
      cancelOrder: jest.fn().mockResolvedValue(undefined),
      rejectOrder: jest.fn().mockResolvedValue({ message: 'Order rejected successfully' }),
      getPendingAssignmentForShipper: jest.fn().mockResolvedValue(null),
      getCompletedOrdersByShipper: jest.fn().mockResolvedValue([]),
    };
    shipperProfileService = {
      getDriverProfile: jest.fn().mockResolvedValue({ name: 'Tài xế A' }),
      updateLocation: jest.fn().mockResolvedValue({ success: true }),
    };
    deliveryReportService = {
      getIncomeReport: jest.fn().mockResolvedValue({ period: 'today' }),
      getShipperDashboard: jest.fn().mockResolvedValue({ earnings: { totalEarnings: 1000 } }),
      getShipperStats: jest.fn().mockResolvedValue({ completedDeliveries: 10 }),
    };

    controller = new ShipperDeliveryController(
      shipperDeliveryService as never,
      shipperProfileService as never,
      deliveryReportService as never,
    );
  });

  it('delegates acceptOrder to shipperDeliveryService', async () => {
    await controller.acceptOrder('order-1', 15, mockReq);
    expect(shipperDeliveryService.assignOrderToShipper).toHaveBeenCalledWith(
      'order-1',
      'shipper-1',
      15,
    );
  });

  it('delegates getProfile to shipperProfileService', async () => {
    const result = await controller.getProfile(mockReq);
    expect(shipperProfileService.getDriverProfile).toHaveBeenCalledWith('shipper-1');
    expect(result).toEqual({ name: 'Tài xế A' });
  });

  it('delegates getIncomeReport to deliveryReportService', async () => {
    await controller.getIncomeReport(mockReq, 'today');
    expect(deliveryReportService.getIncomeReport).toHaveBeenCalledWith(
      'shipper-1',
      'today',
      undefined,
      undefined,
    );
  });

  it('delegates updateLocation to shipperProfileService', async () => {
    await controller.updateLocation(10.762622, 106.660172, mockReq);
    expect(shipperProfileService.updateLocation).toHaveBeenCalledWith(
      'shipper-1',
      10.762622,
      106.660172,
    );
  });
});
