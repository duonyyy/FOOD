import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalyticsOrderMetric } from 'src/entities/analyticsOrderMetric.entity';
import { OrderAnalyticsService, type OrderAnalyticsData } from 'src/features/orders/public-api';
import { Repository } from 'typeorm';

@Injectable()
export class AnalyticsProjectionService {
  constructor(
    @InjectRepository(AnalyticsOrderMetric)
    private readonly metrics: Repository<AnalyticsOrderMetric>,
    private readonly orderAnalytics: OrderAnalyticsService,
  ) {}

  async projectOrder(orderId: string): Promise<boolean> {
    const orderData = await this.orderAnalytics.getOrderData(orderId);
    if (!orderData) return false;
    await this.upsertOrderData(orderData);
    return true;
  }

  async recordPayment(orderId: string, status: 'COMPLETED' | 'FAILED'): Promise<boolean> {
    const exists = await this.ensureOrder(orderId);
    if (!exists) return false;
    await this.metrics.update(
      { orderId },
      {
        paymentStatus: status,
        paymentSucceededAt: status === 'COMPLETED' ? new Date() : null,
      },
    );
    return true;
  }

  async recordDeliveryCompleted(
    orderId: string,
    shipperId: string,
    completedAt: string,
  ): Promise<boolean> {
    const exists = await this.ensureOrder(orderId);
    if (!exists) return false;
    await this.metrics.update(
      { orderId },
      {
        shipperId,
        status: 'completed',
        deliveryCompletedAt: new Date(completedAt),
      },
    );
    return true;
  }

  async upsertOrderData(orderData: OrderAnalyticsData): Promise<void> {
    await this.metrics.upsert(
      {
        orderId: orderData.orderId,
        restaurantId: orderData.restaurantId,
        customerId: orderData.customerId,
        shipperId: orderData.shipperId,
        total: String(orderData.total),
        status: orderData.status,
        createdAt: orderData.createdAt,
        deliveryCompletedAt: orderData.deliveryCompletedAt,
      },
      ['orderId'],
    );
  }

  private async ensureOrder(orderId: string): Promise<boolean> {
    const existing = await this.metrics.exist({ where: { orderId } });
    if (existing) return true;
    return this.projectOrder(orderId);
  }
}
