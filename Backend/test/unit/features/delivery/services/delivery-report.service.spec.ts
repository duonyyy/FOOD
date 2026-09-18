import { ShipperProfile } from 'src/entities/shipperProfile.entity';
import { DeliveryReportService } from 'src/features/delivery/services/shipper/delivery-report.service';

describe('DeliveryReportService unit tests', () => {
  let shippingDetailRepository: { count: jest.Mock; createQueryBuilder: jest.Mock };
  let shipperProfileRepository: { findOne: jest.Mock };
  let identityUserQuery: { findIdentityUser: jest.Mock };
  let service: DeliveryReportService;

  beforeEach(() => {
    shippingDetailRepository = {
      count: jest.fn().mockResolvedValue(5),
      createQueryBuilder: jest.fn(),
    };
    shipperProfileRepository = {
      findOne: jest.fn(),
    };
    identityUserQuery = {
      findIdentityUser: jest.fn(),
    };
    service = new DeliveryReportService(
      shippingDetailRepository as never,
      shipperProfileRepository as never,
      identityUserQuery as never,
    );
  });

  describe('getShipperStats', () => {
    it('calculates completion and rejection ratios correctly', async () => {
      const mockShipper = Object.assign(new ShipperProfile(), {
        userId: 'shipper-1',
        completedDeliveries: 80,
        rejectedOrders: 15,
        failedDeliveries: 5,
        activeDeliveries: 1,
        responseTimeMinutes: 10,
        averageRating: 4.8,
        totalEarnings: 2_500_000,
        certificateStatus: 'APPROVED',
      });

      shipperProfileRepository.findOne.mockResolvedValue(mockShipper);

      const stats = await service.getShipperStats('shipper-1');

      expect(stats.completedDeliveries).toBe(80);
      expect(stats.rejectedOrders).toBe(15);
      expect(stats.totalOrders).toBe(100);
      expect(stats.completionRatio).toBe(0.8);
      expect(stats.rejectionRatio).toBe(0.15);
      expect(stats.failureRatio).toBe(0.05);
      expect(stats.averageRating).toBe(4.8);
      expect(stats.totalEarnings).toBe(2_500_000);
    });

    it('throws NotFoundException when shipper does not exist', async () => {
      shipperProfileRepository.findOne.mockResolvedValue(null);

      await expect(service.getShipperStats('non-existent')).rejects.toThrow('Shipper not found');
    });
  });

  describe('getShipperDashboard', () => {
    it('returns formatted dashboard with performance ranking, badges and milestones', async () => {
      const mockShipper = Object.assign(new ShipperProfile(), {
        userId: 'shipper-1',
        completedDeliveries: 60,
        rejectedOrders: 5,
        failedDeliveries: 2,
        onTimeDeliveries: 55,
        lateDeliveries: 5,
        activeDeliveries: 0,
        averageDeliveryTime: 25,
        responseTimeMinutes: 5,
        averageRating: 4.7,
        totalEarnings: 1_500_000,
        dailyEarnings: 200_000,
        weeklyEarnings: 800_000,
        monthlyEarnings: 1_500_000,
        createdAt: new Date('2025-01-01'),
        lastActiveAt: new Date(),
        certificateStatus: 'APPROVED',
      });

      shipperProfileRepository.findOne.mockResolvedValue(mockShipper);
      identityUserQuery.findIdentityUser.mockResolvedValue({
        userId: 'shipper-1',
        name: 'Nguyen Van A',
        username: 'shipper-a',
        roleName: 'shipper',
        isActive: true,
      });

      const dashboard = await service.getShipperDashboard('shipper-1');

      expect(dashboard.shipperId).toBe('shipper-1');
      expect(dashboard.shipperName).toBe('Nguyen Van A');
      expect(dashboard.deliveryStats.totalCompletedDeliveries).toBe(60);
      expect(dashboard.earnings.totalEarnings).toBe(1_500_000);
      expect(dashboard.performanceRanking.level).toBeDefined();
      expect(dashboard.achievements.length).toBeGreaterThan(0);
      expect(dashboard.nextMilestones.length).toBeGreaterThan(0);
    });
  });
});
