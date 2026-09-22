import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { Repository } from 'typeorm';
import type { DeliveryDispatchCandidate } from '../types/delivery-dispatch.types';

/** Orders-owned read API for Delivery dispatching. */
@Injectable()
export class OrderDeliveryDispatchReaderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findConfirmedDispatchCandidate(orderId: string): Promise<DeliveryDispatchCandidate | null> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, status: 'confirmed' },
      relations: ['restaurant'],
    });
    return order ? this.toDispatchCandidate(order) : null;
  }

  async listConfirmedOrderIds(limit = 100): Promise<string[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const orders = await this.orderRepository.find({
      select: { id: true },
      where: { status: 'confirmed' },
      order: { createdAt: 'ASC' },
      take: safeLimit,
    });

    return orders.map((order) => order.id);
  }

  private toDispatchCandidate(order: Order): DeliveryDispatchCandidate {
    const latitude = order.restaurant?.latitude;
    const longitude = order.restaurant?.longitude;
    return {
      orderId: order.id,
      restaurantLocation:
        latitude != null && longitude != null
          ? { latitude: Number(latitude), longitude: Number(longitude) }
          : null,
      shippingFee: order.shippingFee ?? null,
      shipperEarnings: order.shipperEarnings ?? null,
      deliveryDistance: order.deliveryDistance ?? null,
      shipperCommissionRate: order.shipperCommissionRate ?? null,
      estimatedDeliveryTime: order.estimatedDeliveryTime ?? null,
    };
  }
}
