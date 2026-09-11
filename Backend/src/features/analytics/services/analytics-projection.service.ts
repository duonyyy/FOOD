import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AnalyticsOrderMetric } from 'src/entities/analyticsOrderMetric.entity';
import {
  ORDER_ANALYTICS_READER,
  type OrderAnalyticsReaderPort,
  type OrderAnalyticsSnapshot,
} from 'src/features/orders/public-api';
import { Repository } from 'typeorm';

@Injectable()
export class AnalyticsProjectionService {
  constructor(
    @InjectRepository(AnalyticsOrderMetric)
    private readonly metrics: Repository<AnalyticsOrderMetric>,
    @Inject(ORDER_ANALYTICS_READER)
    private readonly orderReader: OrderAnalyticsReaderPort,
  ) {}

  async projectOrder(orderId: string): Promise<boolean> {
    const snapshot = await this.orderReader.findAnalyticsSnapshot(orderId);
    if (!snapshot) return false;
    await this.upsertSnapshot(snapshot);
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

  async upsertSnapshot(snapshot: OrderAnalyticsSnapshot): Promise<void> {
    await this.metrics.upsert(
      {
        orderId: snapshot.orderId,
        restaurantId: snapshot.restaurantId,
        customerId: snapshot.customerId,
        shipperId: snapshot.shipperId,
        total: String(snapshot.total),
        status: snapshot.status,
        createdAt: snapshot.createdAt,
        deliveryCompletedAt: snapshot.deliveryCompletedAt,
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
