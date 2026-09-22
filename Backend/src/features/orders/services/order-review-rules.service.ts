import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { Repository } from 'typeorm';
import type {
  AssertCustomerCanReviewFoodRequest,
  AssertCustomerCanReviewShipperRequest,
  GetOrderReviewContextRequest,
  OrderReviewContext,
} from '../types/order-review-rules.types';

/** Orders owns the rules that decide whether an Order can be reviewed. */
@Injectable()
export class OrderReviewRulesService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async assertCustomerCanReviewFood(request: AssertCustomerCanReviewFoodRequest): Promise<void> {
    const order = await this.findCompletedCustomerOrder(request.orderId, request.customerId);
    const hasPurchasedFood = (order.orderDetails ?? []).some(
      (detail) => detail.food?.id === request.foodId,
    );
    if (!hasPurchasedFood) {
      throw new ForbiddenException('The reviewed food was not purchased in this order');
    }
  }

  async assertCustomerCanReviewShipper(
    request: AssertCustomerCanReviewShipperRequest,
  ): Promise<void> {
    const order = await this.findCompletedCustomerOrder(request.orderId, request.customerId);
    if (order.shippingDetail?.shipper?.id !== request.shipperId) {
      throw new ForbiddenException('The reviewed shipper did not deliver this order');
    }
  }

  async getOrderReviewContext(request: GetOrderReviewContextRequest): Promise<OrderReviewContext> {
    const order = await this.orderRepository.findOne({
      where: { id: request.orderId },
      relations: [
        'user',
        'restaurant',
        'restaurant.owner',
        'orderDetails',
        'orderDetails.food',
        'shippingDetail',
        'shippingDetail.shipper',
      ],
    });

    if (!order?.user?.id) {
      throw new NotFoundException('Order not found');
    }

    const isAdmin = ['admin', 'administrator', 'super_admin'].includes(request.actorRole ?? '');
    const isParticipant =
      order.user.id === request.actorId ||
      order.restaurant?.owner?.id === request.actorId ||
      order.shippingDetail?.shipper?.id === request.actorId;
    if (!isAdmin && !isParticipant) {
      throw new NotFoundException('Order not found');
    }

    return {
      customerId: order.user.id,
      foodIds: (order.orderDetails ?? [])
        .map((detail) => detail.food?.id)
        .filter((foodId): foodId is string => Boolean(foodId)),
      shipperId: order.shippingDetail?.shipper?.id ?? null,
      status: order.status,
    };
  }

  private async findCompletedCustomerOrder(orderId: string, customerId: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, user: { id: customerId } },
      relations: ['orderDetails', 'orderDetails.food', 'shippingDetail', 'shippingDetail.shipper'],
    });

    if (!order) {
      throw new ForbiddenException('This order is not available for review by the current user');
    }
    if (order.status !== 'completed') {
      throw new ConflictException('Reviews are available only after the order is completed');
    }
    return order;
  }
}
