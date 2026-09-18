import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { Repository } from 'typeorm';

/** Owns the order-side ownership check used by Delivery tracking. */
@Injectable()
export class OrderTrackingReaderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async assertCustomerCanTrackOrder(orderId: string, customerId: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, user: { id: customerId } },
    });

    // Do not reveal whether the order exists to a customer who does not own it.
    if (!order) {
      throw new NotFoundException('Delivery tracking not found');
    }
  }
}
