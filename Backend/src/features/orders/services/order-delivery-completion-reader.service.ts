import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { Repository } from 'typeorm';
import type { DeliveryCompletionOrder } from '../types/delivery-completion.types';

/** Orders-owned read API used by Delivery while settling a completed trip. */
@Injectable()
export class OrderDeliveryCompletionReaderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findForCompletion(orderId: string): Promise<DeliveryCompletionOrder | null> {
    const order = await this.orderRepository.findOne({ where: { id: orderId } });
    if (!order) {
      return null;
    }

    return {
      orderId: order.id,
      status: order.status,
      shippingFee: order.shippingFee ?? null,
      deliveryDistance: order.deliveryDistance ?? null,
      total: order.total ?? null,
      estimatedDeliveryTime: order.estimatedDeliveryTime ?? null,
      shipperEarnings: order.shipperEarnings ?? null,
    };
  }
}
