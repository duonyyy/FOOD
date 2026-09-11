import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { Repository } from 'typeorm';
import {
  type OrderMessagingReaderPort,
  type OrderMessagingSnapshot,
} from '../contracts/order-messaging-reader.port';

/** Read-only order projection used by Communications to authorize conversations. */
@Injectable()
export class OrderMessagingReaderService implements OrderMessagingReaderPort {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findOrderForMessaging(orderId: string): Promise<OrderMessagingSnapshot | null> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'shippingDetail', 'shippingDetail.shipper'],
    });
    return order?.user ? this.toSnapshot(order) : null;
  }

  async listCustomerShipperChatPartners(customerId: string): Promise<OrderMessagingSnapshot[]> {
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'customer')
      .leftJoinAndSelect('order.shippingDetail', 'shippingDetail')
      .leftJoinAndSelect('shippingDetail.shipper', 'shipper')
      .where('order.user_id = :customerId', { customerId })
      .andWhere('shippingDetail.shipper IS NOT NULL')
      .andWhere('order.status IN (:...statuses)', {
        statuses: ['confirmed', 'delivering', 'completed'],
      })
      .getMany();

    return orders.filter((order) => Boolean(order.user)).map((order) => this.toSnapshot(order));
  }

  private toSnapshot(order: Order): OrderMessagingSnapshot {
    return {
      orderId: order.id,
      customerId: order.user.id,
      status: order.status,
      shipperId: order.shippingDetail?.shipper?.id ?? null,
    };
  }
}
