import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  eachDayOfInterval,
  eachMonthOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { AnalyticsOrderMetric } from 'src/entities/analyticsOrderMetric.entity';
import { Between, Repository } from 'typeorm';

export type DashboardPeriod = 'year' | 'month' | 'week';
export type DashboardMetric = 'overview' | 'orders' | 'revenue';

interface StatusCountRow {
  status: string;
  count: string | number;
}

@Injectable()
export class AnalyticsDashboardQueryService {
  constructor(
    @InjectRepository(AnalyticsOrderMetric)
    private readonly metrics: Repository<AnalyticsOrderMetric>,
  ) {}

  async getDashboardStats() {
    const currentYear = new Date().getFullYear();
    const current = this.yearRange(currentYear);
    const previous = this.yearRange(currentYear - 1);
    const [active, priorActive, complete, priorComplete] = await Promise.all([
      this.completedDeliveryAggregate(current.start, current.end),
      this.completedDeliveryAggregate(previous.start, previous.end),
      this.metrics.count({
        where: { status: 'completed', createdAt: Between(current.start, current.end) },
      }),
      this.metrics.count({
        where: { status: 'completed', createdAt: Between(previous.start, previous.end) },
      }),
    ]);

    return [
      this.stat('Shipper Hoạt Động', active.shippers, priorActive.shippers),
      this.stat('Hoàn thành đơn hàng', complete, priorComplete),
      this.stat('Đơn đã giao', active.deliveries, priorActive.deliveries),
    ];
  }

  async getChartData(period: DashboardPeriod, metric: DashboardMetric) {
    const { start, end, intervals, labels } = this.period(period);
    const rows = await this.metrics.find({
      select: ['createdAt', 'total'],
      where: { status: 'completed', createdAt: Between(start, end) },
    });
    const buckets = intervals.map((date) => ({
      start: period === 'year' ? startOfMonth(date) : startOfDay(date),
      end: period === 'year' ? endOfMonth(date) : endOfDay(date),
    }));
    const orderValues = buckets.map(
      (bucket) =>
        rows.filter((row) => row.createdAt >= bucket.start && row.createdAt <= bucket.end).length,
    );
    const revenueValues = buckets.map((bucket) =>
      rows
        .filter((row) => row.createdAt >= bucket.start && row.createdAt <= bucket.end)
        .reduce((sum, row) => sum + Number(row.total), 0),
    );
    if (metric === 'orders') return { order: { labels, values: orderValues } };
    if (metric === 'revenue') return { revenue: { labels, values: revenueValues } };
    return { order: { labels, values: orderValues }, revenue: { labels, values: revenueValues } };
  }

  async getShipperStats(period: DashboardPeriod) {
    const { start, end } = this.period(period);
    const stats = await this.completedDeliveryAggregate(start, end);
    return { period, activeShippers: stats.shippers, totalDeliveries: stats.deliveries };
  }

  async getOrderCompletionStats(period: DashboardPeriod) {
    const { start, end } = this.period(period);
    const stats = await this.metrics
      .createQueryBuilder('metric')
      .select('metric.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('metric.created_at >= :start AND metric.created_at <= :end', { start, end })
      .groupBy('metric.status')
      .getRawMany<StatusCountRow>();
    const totalOrders = stats.reduce((sum, stat) => sum + Number(stat.count), 0);
    const completedOrders = Number(stats.find((stat) => stat.status === 'completed')?.count ?? 0);
    return {
      period,
      totalOrders,
      completedOrders,
      completionRate: totalOrders ? Number(((completedOrders / totalOrders) * 100).toFixed(2)) : 0,
      breakdown: stats.map((stat) => ({
        status: stat.status,
        count: Number(stat.count),
        percentage: totalOrders ? ((Number(stat.count) / totalOrders) * 100).toFixed(2) : '0',
      })),
    };
  }

  async getRestaurantPerformance(page = 1, pageSize = 20) {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(1, pageSize), 100);
    const query = this.metrics
      .createQueryBuilder('metric')
      .select('metric.restaurant_id', 'restaurantId')
      .addSelect('COUNT(*)', 'orderCount')
      .addSelect('COALESCE(SUM(metric.total), 0)', 'revenue')
      .where('metric.status = :status', { status: 'completed' })
      .andWhere('metric.restaurant_id IS NOT NULL')
      .groupBy('metric.restaurant_id')
      .orderBy('COALESCE(SUM(metric.total), 0)', 'DESC')
      .offset((safePage - 1) * safePageSize)
      .limit(safePageSize);
    const items = await query.getRawMany<{
      restaurantId: string;
      orderCount: string;
      revenue: string;
    }>();
    const totalRow = await this.metrics
      .createQueryBuilder('metric')
      .select('COUNT(DISTINCT metric.restaurant_id)', 'count')
      .where('metric.status = :status', { status: 'completed' })
      .andWhere('metric.restaurant_id IS NOT NULL')
      .getRawOne<{ count: string }>();
    const totalItems = Number(totalRow?.count ?? 0);
    return {
      items: items.map((item) => ({
        restaurantId: item.restaurantId,
        orderCount: Number(item.orderCount),
        revenue: Number(item.revenue),
      })),
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / safePageSize),
    };
  }

  private async completedDeliveryAggregate(start: Date, end: Date) {
    const row = await this.metrics
      .createQueryBuilder('metric')
      .select('COUNT(*)', 'deliveries')
      .addSelect('COUNT(DISTINCT metric.shipper_id)', 'shippers')
      .where('metric.delivery_completed_at >= :start AND metric.delivery_completed_at <= :end', {
        start,
        end,
      })
      .getRawOne<{ deliveries: string; shippers: string }>();
    return { deliveries: Number(row?.deliveries ?? 0), shippers: Number(row?.shippers ?? 0) };
  }

  private stat(title: string, current: number, previous: number) {
    const change = previous ? ((current - previous) / previous) * 100 : 0;
    return {
      title,
      value: current.toLocaleString(),
      previousValue: previous.toLocaleString(),
      change: `${change > 0 ? '+' : ''}${change.toFixed(2)}% so với năm trước`,
      isPositive: change >= 0,
    };
  }

  private yearRange(year: number) {
    return { start: new Date(year, 0, 1), end: new Date(year, 11, 31, 23, 59, 59, 999) };
  }

  private period(period: DashboardPeriod) {
    const now = new Date();
    const start =
      period === 'year'
        ? startOfYear(now)
        : period === 'month'
          ? startOfMonth(now)
          : startOfWeek(now, { weekStartsOn: 1 });
    const end =
      period === 'year'
        ? endOfYear(now)
        : period === 'month'
          ? endOfMonth(now)
          : endOfWeek(now, { weekStartsOn: 1 });
    const intervals =
      period === 'year' ? eachMonthOfInterval({ start, end }) : eachDayOfInterval({ start, end });
    const labels = intervals.map((date) => {
      if (period !== 'week') return format(date, period === 'year' ? 'MMM' : 'd');
      return ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
    });
    return { start, end, intervals, labels };
  }
}
