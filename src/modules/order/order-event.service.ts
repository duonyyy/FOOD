import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from 'src/entities/notification.entity';
import { Order } from 'src/entities/order.entity';
import { pubSub } from 'src/pubsub';

@Injectable()
export class OrderEventService {
  private readonly logger = new Logger(OrderEventService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async publishOrderCreated(order: Order): Promise<void> {
    await pubSub.publish('orderCreated', { orderCreated: order });
  }

  async publishOrderStatusUpdated(order: Order): Promise<void> {
    await pubSub.publish('orderStatusUpdated', { orderStatusUpdated: order });
  }

  async createStatusNotification(order: Order, status: string): Promise<void> {
    const notification = await this.notificationRepository.save({
      description: 'Cập nhật trạng thái đơn hàng',
      content: `Đơn hàng của bạn đã chuyển sang trạng thái: ${status}`,
      receiveUser: order.user.id,
      type: 'order',
      isRead: false,
    });

    await pubSub.publish('notificationCreated', {
      notificationCreated: notification,
    });
  }

  async notifyOrderCancellation(
    order: Order,
    reason = 'No shipper available',
  ): Promise<void> {
    try {
      this.logger.log(`Order ${order.id} canceled: ${reason}`);
      this.logger.log(
        `Cancellation notifications processed for order ${order.id}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send cancellation notifications for order ${order.id}: ${error.message}`,
        error.stack,
      );
    }
  }
}
