import { Injectable, NotFoundException } from '@nestjs/common';
import { OrderService } from 'src/modules/order/order.service';
import {
  type OrderNotificationReaderPort,
  type OrderNotificationRecipient,
} from '../contracts/order-notification-reader.port';

/** Compatibility adapter: Notifications sees an Ordering snapshot, never Order persistence. */
@Injectable()
export class OrderNotificationReaderAdapter implements OrderNotificationReaderPort {
  constructor(private readonly orderService: OrderService) {}

  async findNotificationRecipient(orderId: string): Promise<OrderNotificationRecipient | null> {
    try {
      const order = await this.orderService.getOrderById(orderId);
      if (!order.user?.id) return null;
      return { orderId: order.id, customerId: order.user.id };
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }
}
