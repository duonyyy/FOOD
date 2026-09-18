import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { Repository } from 'typeorm';
import type {
  AssertCustomerCanChatWithShipperRequest,
  CustomerShipperChatPartner,
} from '../types/order-messaging.types';

/** Orders-owned authorization and minimal partner lookup for Communications. */
@Injectable()
export class OrderMessagingReaderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async assertCustomerCanChatWithShipper(
    request: AssertCustomerCanChatWithShipperRequest,
  ): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: request.orderId, user: { id: request.customerId } },
      relations: ['shippingDetail', 'shippingDetail.shipper'],
    });
    if (!order) {
      throw new NotFoundException('Order not found or does not belong to you');
    }
    if (order.shippingDetail?.shipper?.id !== request.shipperId) {
      throw new ForbiddenException('You can only chat with the shipper assigned to your order');
    }
    if (!this.isShipperMessagingAllowedStatus(order.status)) {
      throw new ForbiddenException(
        'You can only chat with shipper when order is confirmed or being delivered',
      );
    }
  }

  async listCustomerShipperChatPartners(customerId: string): Promise<CustomerShipperChatPartner[]> {
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.shippingDetail', 'shippingDetail')
      .leftJoinAndSelect('shippingDetail.shipper', 'shipper')
      .where('order.user_id = :customerId', { customerId })
      .andWhere('shippingDetail.shipper IS NOT NULL')
      .andWhere('order.status IN (:...statuses)', {
        statuses: ['confirmed', 'delivering', 'completed'],
      })
      .getMany();

    return orders.flatMap((order) => this.toCustomerShipperChatPartner(order));
  }

  async isOrderOpenForShipperMessaging(orderId: string): Promise<boolean> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    return !order || this.isShipperMessagingAllowedStatus(order.status);
  }

  private toCustomerShipperChatPartner(order: Order): CustomerShipperChatPartner[] {
    const shipperId = order.shippingDetail?.shipper?.id;
    return shipperId
      ? [
          {
            orderId: order.id,
            status: order.status,
            shipperId,
          },
        ]
      : [];
  }

  private isShipperMessagingAllowedStatus(status: string): boolean {
    return ['confirmed', 'delivering', 'completed'].includes(status);
  }
}
