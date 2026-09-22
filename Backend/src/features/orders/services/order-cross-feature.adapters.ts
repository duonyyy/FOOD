import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderCoreService } from 'src/features/orders/services/order-core.service';
import { Repository } from 'typeorm';
import type { OrderAnalyticsPage, OrderAnalyticsSnapshot } from '../types/order-analytics.types';
import type {
  AssertCustomerCanReviewFoodRequest,
  AssertCustomerCanReviewShipperRequest,
} from '../types/order-review-eligibility.types';

/** Compatibility adapter: Analytics receives an Ordering snapshot, never persistence. */
@Injectable()
export class OrderAnalyticsReaderAdapter {
  constructor(private readonly orderCoreService: OrderCoreService) {}

  async findAnalyticsSnapshot(orderId: string): Promise<OrderAnalyticsSnapshot | null> {
    try {
      return await this.orderCoreService.getAnalyticsSnapshot(orderId);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  async listAnalyticsSnapshots(page: number, pageSize: number): Promise<OrderAnalyticsPage> {
    return this.orderCoreService.getAnalyticsSnapshots(page, pageSize);
  }
}

/** Orders owns review permission; Reviews receives no Order data. */
@Injectable()
export class OrderReviewEligibilityService {
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
