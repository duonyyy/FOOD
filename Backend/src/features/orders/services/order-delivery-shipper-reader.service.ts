import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { In, Repository } from 'typeorm';
import type { ShipperOrderView } from '../types/delivery-shipper-order.types';

/** Orders-owned, read-only shape used by a shipper while delivering an order. */
@Injectable()
export class OrderDeliveryShipperReaderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getShipperOrder(orderId: string): Promise<ShipperOrderView> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'restaurant', 'address', 'orderDetails', 'orderDetails.food'],
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return this.toView(order);
  }

  async getShipperOrders(orderIds: readonly string[]): Promise<Map<string, ShipperOrderView>> {
    if (orderIds.length === 0) return new Map();
    const orders = await this.orderRepository.find({
      where: { id: In([...orderIds]) },
      relations: ['user', 'restaurant', 'address', 'orderDetails', 'orderDetails.food'],
    });
    return new Map(orders.map((order) => [order.id, this.toView(order)]));
  }

  private toView(order: Order): ShipperOrderView {
    return {
      id: order.id,
      status: order.status,
      total: order.total ?? null,
      note: order.note ?? null,
      user: order.user ? { id: order.user.id, name: order.user.name ?? null } : null,
      restaurant: order.restaurant
        ? { id: order.restaurant.id, name: order.restaurant.name ?? null }
        : null,
      address: order.address
        ? {
            street: order.address.street ?? null,
            ward: order.address.ward ?? null,
            district: order.address.district ?? null,
            city: order.address.city ?? null,
          }
        : null,
      orderDetails: (order.orderDetails ?? []).map((detail) => ({
        id: detail.id,
        quantity: detail.quantity ?? null,
        price: detail.price ?? null,
        food: detail.food ? { id: detail.food.id, name: detail.food.name ?? null } : null,
      })),
    };
  }
}
