import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { Repository } from 'typeorm';
import type { OrderAnalyticsData, OrderAnalyticsPage } from '../types/order-analytics.types';

@Injectable()
export class OrderAnalyticsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getOrderData(orderId: string): Promise<OrderAnalyticsData | null> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'restaurant', 'shippingDetail', 'shippingDetail.shipper'],
    });

    return order ? this.toOrderData(order) : null;
  }

  async listOrderData(page = 1, pageSize = 200): Promise<OrderAnalyticsPage> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(1, pageSize), 500);
    const [orders, totalItems] = await this.orderRepository.findAndCount({
      relations: ['user', 'restaurant', 'shippingDetail', 'shippingDetail.shipper'],
      order: { createdAt: 'ASC' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    });

    return {
      items: orders.map((order) => this.toOrderData(order)),
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / safePageSize),
    };
  }

  private toOrderData(order: Order): OrderAnalyticsData {
    return {
      orderId: order.id,
      restaurantId: order.restaurant?.id ?? null,
      customerId: order.user?.id ?? null,
      shipperId: order.shippingDetail?.shipper?.id ?? null,
      total: Number(order.total ?? 0),
      status: order.status ?? 'pending',
      createdAt: order.createdAt,
      deliveryCompletedAt: order.shippingDetail?.actualDeliveryTime ?? null,
    };
  }
}
