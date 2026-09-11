import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from 'src/features/analytics/controllers/dashboard.controller';
import { DashboardService } from 'src/features/analytics/services/dashboard.service';
import { RolesGuard } from 'src/features/auth/guards/roles.guard';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: {
    getDashboardStats: jest.Mock;
    getChartData: jest.Mock;
    getShipperStats: jest.Mock;
    getOrderCompletionStats: jest.Mock;
    getRestaurantPerformance: jest.Mock;
  };

  beforeEach(async () => {
    service = {
      getDashboardStats: jest.fn().mockResolvedValue({ totalOrders: 100 }),
      getChartData: jest.fn().mockResolvedValue({ labels: [], datasets: [] }),
      getShipperStats: jest.fn().mockResolvedValue({ activeShippers: 5 }),
      getOrderCompletionStats: jest.fn().mockResolvedValue({ completedRate: 95 }),
      getRestaurantPerformance: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DashboardController>(DashboardController);
  });

  it('delegates getDashboardStats to service', async () => {
    const result = await controller.getDashboardStats();
    expect(result).toEqual({ totalOrders: 100 });
    expect(service.getDashboardStats).toHaveBeenCalled();
  });

  it('delegates getChartData to service with params', async () => {
    const result = await controller.getChartData('month', 'revenue');
    expect(result).toEqual({ labels: [], datasets: [] });
    expect(service.getChartData).toHaveBeenCalledWith('month', 'revenue');
  });

  it('delegates getShipperStats to service', async () => {
    const result = await controller.getShipperStats('year');
    expect(result).toEqual({ activeShippers: 5 });
    expect(service.getShipperStats).toHaveBeenCalledWith('year');
  });

  it('delegates getOrderCompletionStats to service', async () => {
    const result = await controller.getOrderCompletionStats('week');
    expect(result).toEqual({ completedRate: 95 });
    expect(service.getOrderCompletionStats).toHaveBeenCalledWith('week');
  });

  it('delegates getRestaurantPerformance to service with pagination', async () => {
    const result = await controller.getRestaurantPerformance(1, 20);
    expect(result).toEqual({ items: [], total: 0 });
    expect(service.getRestaurantPerformance).toHaveBeenCalledWith(1, 20);
  });
});
