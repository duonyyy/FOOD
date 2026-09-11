import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { Repository } from 'typeorm';
import {
  type CustomerOrderTrackingSnapshot,
  type OrderTrackingReaderPort,
} from '../contracts/order-tracking-reader.port';

/** Owns the order-side ownership check used by Delivery tracking. */
@Injectable()
export class OrderTrackingReaderService implements OrderTrackingReaderPort {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findCustomerOrderForTracking(
    orderId: string,
    customerId: string,
  ): Promise<CustomerOrderTrackingSnapshot | null> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, user: { id: customerId } },
    });

    return order ? { orderId: order.id } : null;
  }
}
