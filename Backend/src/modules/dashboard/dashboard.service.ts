import { Injectable } from '@nestjs/common';
import {
  AnalyticsDashboardQueryService,
  type DashboardMetric,
  type DashboardPeriod,
} from 'src/features/analytics/analytics-dashboard-query.service';

/** Compatibility facade for the legacy HTTP controller. */
@Injectable()
export class DashboardService {
  constructor(private readonly analytics: AnalyticsDashboardQueryService) {}

  getDashboardStats() {
    return this.analytics.getDashboardStats();
  }

  getChartData(period: DashboardPeriod, metric: DashboardMetric) {
    return this.analytics.getChartData(period, metric);
  }

  getShipperStats(period: DashboardPeriod) {
    return this.analytics.getShipperStats(period);
  }

  getOrderCompletionStats(period: DashboardPeriod) {
    return this.analytics.getOrderCompletionStats(period);
  }

  getRestaurantPerformance(page: number, pageSize: number) {
    return this.analytics.getRestaurantPerformance(page, pageSize);
  }
}
