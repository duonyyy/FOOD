import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { addDays, format, startOfDay, startOfWeek } from 'date-fns';
import { ShippingDetail, ShippingStatus } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { LessThan, Repository } from 'typeorm';

interface EarningsReportRow {
  grouped_date: string | Date;
  total_earnings: string | number | null;
  delivery_count: string | number | null;
  avg_earnings_per_delivery: string | number | null;
  total_shipping_fees: string | number | null;
  avg_distance: string | number | null;
}

interface EarningsReportData {
  earnings: number;
  deliveryCount: number;
  avgEarningsPerDelivery: number;
  totalShippingFees: number;
  avgDistance: number;
}

/**
 * DeliveryReportService handles income reports, dashboards, ranking, and performance metrics for Shippers.
 */
@Injectable()
export class DeliveryReportService {
  private readonly logger = new Logger(DeliveryReportService.name);

  constructor(
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async getIncomeReport(
    shipperId: string,
    range: 'today' | 'week' | 'month',
    monthStr?: string,
    yearStr?: string,
  ) {
    let fromDate: Date;
    let groupBy: 'day' | 'week' | 'month';

    if (range === 'today') {
      fromDate = startOfDay(new Date());
      groupBy = 'day';
    } else if (range === 'week') {
      fromDate = startOfWeek(new Date(), { weekStartsOn: 1 });
      groupBy = 'day';
    } else {
      const month = Number(monthStr || new Date().getMonth() + 1);
      const year = Number(yearStr || new Date().getFullYear());
      fromDate = new Date(year, month - 1, 1);
      groupBy = 'day';
    }

    const raw = await this.shippingDetailRepository
      .createQueryBuilder('sd')
      .leftJoin('sd.order', 'o')
      .select([
        `DATE_TRUNC('${groupBy}', sd."actualDeliveryTime") AS grouped_date`,
        `COUNT(sd.id) AS delivery_count`,
        `SUM(COALESCE(o."shipperEarnings", 0)) AS total_earnings`,
        `AVG(COALESCE(o."shipperEarnings", 0)) AS avg_earnings_per_delivery`,
        `SUM(COALESCE(o."shippingFee", 0)) AS total_shipping_fees`,
        `AVG(COALESCE(o."deliveryDistance", 0)) AS avg_distance`,
      ])
      .where(`sd."user_id" = :shipperId`, { shipperId })
      .andWhere(`sd.status = :status`, { status: 'COMPLETED' })
      .andWhere(`sd."actualDeliveryTime" >= :fromDate`, { fromDate })
      .groupBy('grouped_date')
      .orderBy('grouped_date', 'ASC')
      .getRawMany<EarningsReportRow>();

    const dateMap = new Map<string, EarningsReportData>();

    raw.forEach((r) => {
      const date = new Date(r.grouped_date);
      const key = format(date, 'yyyy-MM-dd');

      dateMap.set(key, {
        earnings: Number(r.total_earnings) || 0,
        deliveryCount: Number(r.delivery_count) || 0,
        avgEarningsPerDelivery: Number(r.avg_earnings_per_delivery) || 0,
        totalShippingFees: Number(r.total_shipping_fees) || 0,
        avgDistance: Number(r.avg_distance) || 0,
      });
    });

    let days: number;
    let endDate: Date;

    if (range === 'today') {
      days = 1;
      endDate = fromDate;
    } else if (range === 'week') {
      days = 7;
      endDate = addDays(fromDate, 6);
    } else {
      const month = Number(monthStr || new Date().getMonth() + 1);
      const year = Number(yearStr || new Date().getFullYear());
      days = new Date(year, month, 0).getDate();
      endDate = new Date(year, month - 1, days - 1);
    }

    const labels: string[] = [];
    const earningsData: number[] = [];
    const deliveryCountData: number[] = [];
    const avgEarningsData: number[] = [];

    for (let i = 0; i < days; i++) {
      const currentDate = addDays(fromDate, i);
      const key = format(currentDate, 'yyyy-MM-dd');

      const data = dateMap.get(key) || {
        earnings: 0,
        deliveryCount: 0,
        avgEarningsPerDelivery: 0,
        totalShippingFees: 0,
        avgDistance: 0,
      };

      let label: string;
      if (range === 'today') {
        label = 'Hôm nay';
      } else if (range === 'week') {
        const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        label = dayNames[currentDate.getDay()];
      } else {
        label = `${currentDate.getDate()}/${currentDate.getMonth() + 1}`;
      }

      labels.push(label);
      earningsData.push(data.earnings);
      deliveryCountData.push(data.deliveryCount);
      avgEarningsData.push(data.avgEarningsPerDelivery);
    }

    const totalEarnings = earningsData.reduce((sum, val) => sum + val, 0);
    const totalDeliveries = deliveryCountData.reduce((sum, val) => sum + val, 0);
    const avgEarningsPerDelivery = totalDeliveries > 0 ? totalEarnings / totalDeliveries : 0;
    const maxEarningsIndex = earningsData.indexOf(Math.max(...earningsData));

    return {
      period: range,
      dateRange: {
        from: format(fromDate, 'yyyy-MM-dd'),
        to: format(range === 'today' ? fromDate : endDate, 'yyyy-MM-dd'),
      },
      labels,
      data: {
        earnings: earningsData,
        deliveryCount: deliveryCountData,
        avgEarningsPerDelivery: avgEarningsData,
      },
      summary: {
        totalEarnings,
        totalDeliveries,
        avgEarningsPerDelivery: Math.round(avgEarningsPerDelivery),
        bestDay: {
          date: labels[maxEarningsIndex] || 'N/A',
          earnings: Math.max(...earningsData) || 0,
          deliveries: deliveryCountData[maxEarningsIndex] || 0,
        },
        worstDay: {
          date:
            labels[earningsData.indexOf(Math.min(...earningsData.filter((e) => e > 0)))] || 'N/A',
          earnings: Math.min(...earningsData.filter((e) => e > 0)) || 0,
        },
        formatted: {
          totalEarnings: `${totalEarnings.toLocaleString('vi-VN')}đ`,
          avgEarningsPerDelivery: `${Math.round(avgEarningsPerDelivery).toLocaleString('vi-VN')}đ`,
          avgEarningsPerDay: `${Math.round(totalEarnings / days).toLocaleString('vi-VN')}đ`,
        },
      },
      analytics: {
        peakPerformanceDays: labels.filter(
          (_, index) => earningsData[index] > avgEarningsPerDelivery,
        ),
        consistency: this.calculateConsistencyScore(earningsData),
        trend: this.calculateTrend(earningsData),
        workloadDistribution: {
          lightDays: deliveryCountData.filter((count) => count <= 2).length,
          moderateDays: deliveryCountData.filter((count) => count > 2 && count <= 5).length,
          heavyDays: deliveryCountData.filter((count) => count > 5).length,
        },
      },
    };
  }

  private calculateConsistencyScore(earningsData: number[]): number {
    if (earningsData.length === 0) return 0;

    const nonZeroEarnings = earningsData.filter((e) => e > 0);
    if (nonZeroEarnings.length === 0) return 0;

    const mean = nonZeroEarnings.reduce((a, b) => a + b) / nonZeroEarnings.length;
    const variance =
      nonZeroEarnings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / nonZeroEarnings.length;
    const standardDeviation = Math.sqrt(variance);

    const coefficientOfVariation = mean > 0 ? standardDeviation / mean : 1;
    return Math.max(0, Math.min(100, 100 - coefficientOfVariation * 50));
  }

  private calculateTrend(earningsData: number[]): string {
    if (earningsData.length < 2) return 'insufficient_data';

    const firstHalf = earningsData.slice(0, Math.floor(earningsData.length / 2));
    const secondHalf = earningsData.slice(Math.floor(earningsData.length / 2));

    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const percentChange =
      firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

    if (percentChange > 10) return 'improving';
    if (percentChange < -10) return 'declining';
    return 'stable';
  }

  async getShipperDashboard(shipperId: string) {
    const shipper = await this.userRepository.findOne({
      where: { id: shipperId },
      relations: ['shipperCertificateInfo'],
    });

    if (!shipper) {
      throw new NotFoundException('Shipper not found');
    }

    const completedDeliveries = shipper.completedDeliveries || 0;
    const rejectedOrders = shipper.rejectedOrders || 0;
    const failedDeliveries = shipper.failedDeliveries || 0;
    const onTimeDeliveries = shipper.onTimeDeliveries || 0;
    const lateDeliveries = shipper.lateDeliveries || 0;
    const totalOrders = completedDeliveries + rejectedOrders + failedDeliveries;

    const completionRate = totalOrders > 0 ? (completedDeliveries / totalOrders) * 100 : 0;
    const rejectionRate = totalOrders > 0 ? (rejectedOrders / totalOrders) * 100 : 0;
    const onTimeRate =
      onTimeDeliveries + lateDeliveries > 0
        ? (onTimeDeliveries / (onTimeDeliveries + lateDeliveries)) * 100
        : 0;

    const recentDeliveries = await this.shippingDetailRepository.count({
      where: {
        shipper: { id: shipperId },
        status: ShippingStatus.COMPLETED,
        actualDeliveryTime: LessThan(new Date()),
      },
    });

    return {
      shipperId: shipper.id,
      shipperName: shipper.name || shipper.username,
      status: shipper.shipperCertificateInfo?.status || 'PENDING',
      isActive: shipper.isActive,
      averageRating: shipper.averageRating || 5.0,

      deliveryStats: {
        totalCompletedDeliveries: completedDeliveries,
        activeDeliveries: shipper.activeDeliveries || 0,
        rejectedOrders: rejectedOrders,
        failedDeliveries: failedDeliveries,
        totalOrders: totalOrders,
        recentDeliveries30Days: recentDeliveries,

        completionRate: Math.round(completionRate * 100) / 100,
        rejectionRate: Math.round(rejectionRate * 100) / 100,
        onTimeDeliveryRate: Math.round(onTimeRate * 100) / 100,

        averageDeliveryTime: Math.round((shipper.averageDeliveryTime || 0) * 100) / 100,
        averageResponseTime: Math.round((shipper.responseTimeMinutes || 0) * 100) / 100,
        onTimeDeliveries: onTimeDeliveries,
        lateDeliveries: lateDeliveries,
      },

      earnings: {
        totalEarnings: shipper.totalEarnings || 0,
        dailyEarnings: shipper.dailyEarnings || 0,
        weeklyEarnings: shipper.weeklyEarnings || 0,
        monthlyEarnings: shipper.monthlyEarnings || 0,
        averageEarningsPerDelivery:
          completedDeliveries > 0
            ? Math.round((shipper.totalEarnings || 0) / completedDeliveries)
            : 0,

        formattedEarnings: {
          total: `${(shipper.totalEarnings || 0).toLocaleString()}đ`,
          daily: `${(shipper.dailyEarnings || 0).toLocaleString()}đ`,
          weekly: `${(shipper.weeklyEarnings || 0).toLocaleString()}đ`,
          monthly: `${(shipper.monthlyEarnings || 0).toLocaleString()}đ`,
          perDelivery:
            completedDeliveries > 0
              ? `${Math.round((shipper.totalEarnings || 0) / completedDeliveries).toLocaleString()}đ`
              : '0đ',
        },
      },

      performanceRanking: this.calculatePerformanceRanking(shipper),
      achievements: this.calculateAchievements(shipper),
      lastActiveAt: shipper.lastActiveAt?.toISOString() || null,
      accountCreatedAt: shipper.createdAt.toISOString(),
      nextMilestones: this.calculateNextMilestones(shipper),
    };
  }

  private calculateAchievements(shipper: User): Array<{
    name: string;
    description: string;
    earned: boolean;
    progress?: number;
  }> {
    const completedDeliveries = shipper.completedDeliveries || 0;
    const rating = shipper.averageRating || 5.0;
    const onTimeDeliveries = shipper.onTimeDeliveries || 0;
    const totalEarnings = shipper.totalEarnings || 0;

    return [
      {
        name: 'Người mới',
        description: 'Hoàn thành đơn hàng đầu tiên',
        earned: completedDeliveries >= 1,
        progress: Math.min(100, completedDeliveries * 100),
      },
      {
        name: 'Thành viên tích cực',
        description: 'Hoàn thành 50 đơn hàng',
        earned: completedDeliveries >= 50,
        progress: Math.min(100, (completedDeliveries / 50) * 100),
      },
      {
        name: 'Shipper chuyên nghiệp',
        description: 'Hoàn thành 200 đơn hàng',
        earned: completedDeliveries >= 200,
        progress: Math.min(100, (completedDeliveries / 200) * 100),
      },
      {
        name: 'Đánh giá cao',
        description: 'Đạt đánh giá trung bình 4.5 sao',
        earned: rating >= 4.5,
        progress: Math.min(100, (rating / 4.5) * 100),
      },
      {
        name: 'Đúng giờ',
        description: 'Giao 100 đơn hàng đúng giờ',
        earned: onTimeDeliveries >= 100,
        progress: Math.min(100, (onTimeDeliveries / 100) * 100),
      },
      {
        name: 'Triệu phú',
        description: 'Kiếm được 1,000,000đ',
        earned: totalEarnings >= 1000000,
        progress: Math.min(100, (totalEarnings / 1000000) * 100),
      },
    ];
  }

  private calculateNextMilestones(shipper: User): Array<{
    milestone: string;
    current: number;
    target: number;
    progress: number;
  }> {
    const completedDeliveries = shipper.completedDeliveries || 0;
    const totalEarnings = shipper.totalEarnings || 0;
    const onTimeDeliveries = shipper.onTimeDeliveries || 0;

    const milestones: {
      milestone: string;
      current: number;
      target: number;
      progress: number;
    }[] = [];

    const deliveryTargets = [10, 25, 50, 100, 200, 500, 1000];
    const nextDeliveryTarget = deliveryTargets.find((target) => target > completedDeliveries);
    if (nextDeliveryTarget) {
      milestones.push({
        milestone: `${nextDeliveryTarget} đơn hàng hoàn thành`,
        current: completedDeliveries,
        target: nextDeliveryTarget,
        progress: (completedDeliveries / nextDeliveryTarget) * 100,
      });
    }

    const earningsTargets = [100000, 500000, 1000000, 5000000, 10000000];
    const nextEarningsTarget = earningsTargets.find((target) => target > totalEarnings);
    if (nextEarningsTarget) {
      milestones.push({
        milestone: `${(nextEarningsTarget / 1000000).toFixed(1)}M đồng thu nhập`,
        current: totalEarnings,
        target: nextEarningsTarget,
        progress: (totalEarnings / nextEarningsTarget) * 100,
      });
    }

    const onTimeTargets = [10, 25, 50, 100, 250, 500];
    const nextOnTimeTarget = onTimeTargets.find((target) => target > onTimeDeliveries);
    if (nextOnTimeTarget) {
      milestones.push({
        milestone: `${nextOnTimeTarget} đơn giao đúng giờ`,
        current: onTimeDeliveries,
        target: nextOnTimeTarget,
        progress: (onTimeDeliveries / nextOnTimeTarget) * 100,
      });
    }

    return milestones;
  }

  private calculatePerformanceRanking(shipper: User): {
    level: string;
    score: number;
    nextLevelRequirements: string[];
  } {
    const completedDeliveries = shipper.completedDeliveries || 0;
    const rating = shipper.averageRating || 5.0;
    const onTimeRate =
      ((shipper.onTimeDeliveries || 0) /
        Math.max(1, (shipper.onTimeDeliveries || 0) + (shipper.lateDeliveries || 0))) *
      100;
    const rejectionRate =
      ((shipper.rejectedOrders || 0) /
        Math.max(1, (shipper.completedDeliveries || 0) + (shipper.rejectedOrders || 0))) *
      100;

    let level = 'Mới bắt đầu';
    let score = 0;
    const requirements: string[] = [];

    score += completedDeliveries * 2;
    score += (rating - 3) * 20;
    score += onTimeRate * 0.5;
    score -= rejectionRate * 0.3;

    if (completedDeliveries >= 500 && rating >= 4.8 && onTimeRate >= 95 && rejectionRate <= 5) {
      level = 'Huyền thoại';
    } else if (
      completedDeliveries >= 200 &&
      rating >= 4.6 &&
      onTimeRate >= 90 &&
      rejectionRate <= 10
    ) {
      level = 'Chuyên gia';
    } else if (
      completedDeliveries >= 100 &&
      rating >= 4.4 &&
      onTimeRate >= 85 &&
      rejectionRate <= 15
    ) {
      level = 'Thành thạo';
    } else if (
      completedDeliveries >= 50 &&
      rating >= 4.2 &&
      onTimeRate >= 80 &&
      rejectionRate <= 20
    ) {
      level = 'Tiến bộ';
    } else if (completedDeliveries >= 20 && rating >= 4.0 && onTimeRate >= 75) {
      level = 'Phát triển';
    }

    if (level === 'Mới bắt đầu') {
      if (completedDeliveries < 20)
        requirements.push(`Hoàn thành ${20 - completedDeliveries} đơn hàng nữa`);
      if (rating < 4.0) requirements.push(`Cải thiện đánh giá lên 4.0 sao`);
      if (onTimeRate < 75) requirements.push(`Cải thiện tỷ lệ giao hàng đúng giờ lên 75%`);
    } else if (level === 'Phát triển') {
      if (completedDeliveries < 50)
        requirements.push(`Hoàn thành ${50 - completedDeliveries} đơn hàng nữa`);
      if (rating < 4.2) requirements.push(`Cải thiện đánh giá lên 4.2 sao`);
      if (onTimeRate < 80) requirements.push(`Cải thiện tỷ lệ giao hàng đúng giờ lên 80%`);
    } else if (level === 'Tiến bộ') {
      if (completedDeliveries < 100)
        requirements.push(`Hoàn thành ${100 - completedDeliveries} đơn hàng nữa`);
      if (rating < 4.4) requirements.push(`Cải thiện đánh giá lên 4.4 sao`);
      if (onTimeRate < 85) requirements.push(`Cải thiện tỷ lệ giao hàng đúng giờ lên 85%`);
    } else if (level === 'Thành thạo') {
      if (completedDeliveries < 200)
        requirements.push(`Hoàn thành ${200 - completedDeliveries} đơn hàng nữa`);
      if (rating < 4.6) requirements.push(`Cải thiện đánh giá lên 4.6 sao`);
      if (onTimeRate < 90) requirements.push(`Cải thiện tỷ lệ giao hàng đúng giờ lên 90%`);
    } else if (level === 'Chuyên gia') {
      if (completedDeliveries < 500)
        requirements.push(`Hoàn thành ${500 - completedDeliveries} đơn hàng nữa`);
      if (rating < 4.8) requirements.push(`Cải thiện đánh giá lên 4.8 sao`);
      if (onTimeRate < 95) requirements.push(`Cải thiện tỷ lệ giao hàng đúng giờ lên 95%`);
    }

    return {
      level,
      score: Math.round(score),
      nextLevelRequirements: requirements,
    };
  }

  async getShipperStats(shipperId: string) {
    const shipper = await this.userRepository.findOne({
      where: { id: shipperId },
      relations: ['shipperCertificateInfo'],
    });

    if (!shipper) {
      throw new NotFoundException('Shipper not found');
    }

    const completedDeliveries = shipper.completedDeliveries || 0;
    const rejectedOrders = shipper.rejectedOrders || 0;
    const failedDeliveries = shipper.failedDeliveries || 0;
    const totalOrders = completedDeliveries + rejectedOrders + failedDeliveries;

    const rejectionRatio = totalOrders > 0 ? rejectedOrders / totalOrders : 0;
    const completionRatio = totalOrders > 0 ? completedDeliveries / totalOrders : 0;
    const failureRatio = totalOrders > 0 ? failedDeliveries / totalOrders : 0;

    return {
      completedDeliveries,
      rejectedOrders,
      failedDeliveries,
      totalOrders,
      activeDeliveries: shipper.activeDeliveries || 0,
      rejectionRatio: Math.round(rejectionRatio * 100) / 100,
      completionRatio: Math.round(completionRatio * 100) / 100,
      failureRatio: Math.round(failureRatio * 100) / 100,
      averageResponseTime: shipper.responseTimeMinutes || 0,
      status: shipper.shipperCertificateInfo?.status || 'PENDING',
      averageRating: shipper.averageRating || 0,
      totalEarnings: shipper.totalEarnings || 0,
    };
  }
}
