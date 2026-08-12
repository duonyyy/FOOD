import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { Repository } from 'typeorm';
import {
  type FindOrderReviewEligibilityRequest,
  type OrderReviewEligibilityReaderPort,
  type OrderReviewEligibilitySnapshot,
} from '../contracts/order-review-eligibility-reader.port';

@Injectable()
export class OrderReviewEligibilityService implements OrderReviewEligibilityReaderPort {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async findReviewEligibility(
    request: FindOrderReviewEligibilityRequest,
  ): Promise<OrderReviewEligibilitySnapshot | null> {
    const order = await this.orderRepository.findOne({
      where: { id: request.orderId, user: { id: request.customerId } },
      relations: [
        'user',
        'orderDetails',
        'orderDetails.food',
        'shippingDetail',
        'shippingDetail.shipper',
      ],
    });

    if (!order || !order.user) {
      return null;
    }

    return {
      orderId: order.id,
      customerId: order.user.id,
      orderStatus: order.status ?? null,
      foodIds: (order.orderDetails ?? []).map((detail) => detail.food.id),
      shipperId: order.shippingDetail?.shipper?.id ?? null,
    };
  }
}
