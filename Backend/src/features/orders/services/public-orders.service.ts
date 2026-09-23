import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { Repository } from 'typeorm';

/** Shared order lookups used by HTTP, GraphQL and Orders event handlers. */
@Injectable()
export class PublicOrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async getOrderById(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: [
        'user',
        'user.role',
        'user.address',
        'restaurant',
        'restaurant.owner',
        'restaurant.address',
        'orderDetails',
        'orderDetails.food',
        'shippingDetail',
        'shippingDetail.shipper',
        'promotionCode',
        'address',
      ],
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.cleanSensitiveData(order);
  }

  async getOrderDetails(orderId: string): Promise<OrderDetail[]> {
    const order = await this.getOrderById(orderId);
    return order.orderDetails ?? [];
  }

  cleanSensitiveData(order: Order): Order {
    if (order.user) {
      this.removeFields(order.user, [
        'password',
        'resetPasswordToken',
        'resetPasswordExpires',
        'birthday',
        'lastLoginAt',
        'createdAt',
        'googleId',
      ]);
      if (order.user.role) {
        this.removeFields(order.user.role, ['isSystem', 'description', 'createdAt', 'updatedAt']);
      }
      order.user.address?.forEach((address) => {
        this.removeFields(address, ['latitude', 'longitude']);
      });
    }

    if (order.restaurant) {
      this.removeFields(order.restaurant, [
        'openTime',
        'closeTime',
        'licenseCode',
        'certificateImage',
        'updatedAt',
        'createdAt',
      ]);
    }

    order.orderDetails?.forEach((detail) => {
      if (detail.food) this.removeFields(detail.food, ['soldCount', 'purchasedNumber']);
    });

    if (order.shippingDetail?.shipper) {
      this.removeFields(order.shippingDetail.shipper, [
        'password',
        'resetPasswordToken',
        'resetPasswordExpires',
        'email',
        'birthday',
        'lastLoginAt',
        'createdAt',
        'googleId',
        'address',
        'role',
      ]);
    }

    if (order.promotionCode) {
      this.removeFields(order.promotionCode, ['maxUsage', 'numberOfUsed']);
    }
    return order;
  }

  private removeFields(target: object, fields: readonly string[]): void {
    for (const field of fields) Reflect.deleteProperty(target, field);
  }
}
