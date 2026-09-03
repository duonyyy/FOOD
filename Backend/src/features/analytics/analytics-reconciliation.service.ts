import { Inject, Injectable } from '@nestjs/common';
import {
  ORDER_ANALYTICS_READER,
  type OrderAnalyticsReaderPort,
} from 'src/features/orders/public-api';
import { AnalyticsProjectionService } from './analytics-projection.service';

/** Explicit rebuild entry point for operational reconciliation, never an HTTP write endpoint. */
@Injectable()
export class AnalyticsReconciliationService {
  constructor(
    @Inject(ORDER_ANALYTICS_READER)
    private readonly orderReader: OrderAnalyticsReaderPort,
    private readonly projection: AnalyticsProjectionService,
  ) {}

  async rebuild(pageSize = 200): Promise<{ processed: number; pages: number }> {
    let page = 1;
    let processed = 0;
    let pages = 0;
    let hasMore = true;

    while (hasMore) {
      const batch = await this.orderReader.listAnalyticsSnapshots(page, pageSize);
      await Promise.all(batch.items.map((snapshot) => this.projection.upsertSnapshot(snapshot)));
      processed += batch.items.length;
      pages += 1;
      hasMore = page < batch.totalPages;
      page += 1;
    }

    return { processed, pages };
  }
}
