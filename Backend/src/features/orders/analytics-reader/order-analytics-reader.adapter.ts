import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderService } from 'src/modules/order/order.service';
import {
  type OrderAnalyticsPage,
  type OrderAnalyticsReaderPort,
  type OrderAnalyticsSnapshot,
} from '../contracts/order-analytics-reader.port';

/** Compatibility adapter: Analytics receives an Ordering snapshot, never persistence. */
@Injectable()
export class OrderAnalyticsReaderAdapter implements OrderAnalyticsReaderPort {
  constructor(private readonly orderService: OrderService) {}

  async findAnalyticsSnapshot(orderId: string): Promise<OrderAnalyticsSnapshot | null> {
    try {
      return await this.orderService.getAnalyticsSnapshot(orderId);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  async listAnalyticsSnapshots(page: number, pageSize: number): Promise<OrderAnalyticsPage> {
    return this.orderService.getAnalyticsSnapshots(page, pageSize);
  }
}
