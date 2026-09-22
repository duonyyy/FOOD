import { Injectable } from '@nestjs/common';
import { OrderAnalyticsService } from 'src/features/orders/public-api';
import { AnalyticsProjectionService } from './analytics-projection.service';

/** Explicit rebuild entry point for operational reconciliation, never an HTTP write endpoint. */
@Injectable()
export class AnalyticsReconciliationService {
  constructor(
    private readonly orderAnalytics: OrderAnalyticsService,
    private readonly projection: AnalyticsProjectionService,
  ) {}

  async rebuild(pageSize = 200): Promise<{ processed: number; pages: number }> {
    let page = 1;
    let processed = 0;
    let pages = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.orderAnalytics.listOrderData(page, pageSize);
      await Promise.all(batch.items.map((orderData) => this.projection.upsertOrderData(orderData)));
      processed += batch.items.length;
      pages += 1;
      hasMore = page < batch.totalPages;
      page += 1;
    }

    return { processed, pages };
  }
}
