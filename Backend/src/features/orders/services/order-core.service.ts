import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import {
  ORDER_REVIEW_READER,
  type OrderReviewReaderPort,
} from 'src/features/reviews/review-reader.public-api';
import { Repository } from 'typeorm';
import {
  type OrderAnalyticsPage,
  type OrderAnalyticsSnapshot,
} from '../contracts/order-analytics-reader.port';

// ==========================================
// 1. ORDER STATE MACHINE
// ==========================================

export enum OrderStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  DELIVERING = 'delivering',
  SHIPPER_RECEIVED = 'shipper_received',
  COMPLETED = 'completed',
  CANCELED = 'canceled',
  PROCESSING_PAYMENT = 'processing_payment',
}

export const ORDER_STATUS_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> =
  Object.freeze({
    [OrderStatus.PENDING]: Object.freeze([OrderStatus.CONFIRMED, OrderStatus.CANCELED]),
    [OrderStatus.CONFIRMED]: Object.freeze([
      OrderStatus.SHIPPER_RECEIVED,
      OrderStatus.DELIVERING,
      OrderStatus.CANCELED,
    ]),
    [OrderStatus.SHIPPER_RECEIVED]: Object.freeze([OrderStatus.DELIVERING, OrderStatus.CANCELED]),
    [OrderStatus.DELIVERING]: Object.freeze([OrderStatus.COMPLETED, OrderStatus.CANCELED]),
    [OrderStatus.PROCESSING_PAYMENT]: Object.freeze([OrderStatus.PENDING, OrderStatus.CANCELED]),
    [OrderStatus.COMPLETED]: Object.freeze([]),
    [OrderStatus.CANCELED]: Object.freeze([]),
  });

export class InvalidOrderStatusError extends Error {
  constructor(public readonly status: string) {
    super(`Invalid order status: ${status}`);
    this.name = 'InvalidOrderStatusError';
  }
}

export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Cannot change status from ${from} to ${to}`);
    this.name = 'InvalidOrderTransitionError';
  }
}

export function parseOrderStatus(status: string): OrderStatus {
  if (Object.values(OrderStatus).includes(status as OrderStatus)) {
    return status as OrderStatus;
  }
  throw new InvalidOrderStatusError(status);
}

export class OrderStateMachine {
  canTransition(from: string, to: string): boolean {
    const currentStatus = parseOrderStatus(from);
    const nextStatus = parseOrderStatus(to);
    return ORDER_STATUS_TRANSITIONS[currentStatus].includes(nextStatus);
  }

  transition(from: string, to: string): OrderStatus {
    const currentStatus = parseOrderStatus(from);
    const nextStatus = parseOrderStatus(to);
    if (!ORDER_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)) {
      throw new InvalidOrderTransitionError(currentStatus, nextStatus);
    }
    return nextStatus;
  }

  confirm(from: string): OrderStatus {
    return this.transition(from, OrderStatus.CONFIRMED);
  }

  reject(from: string): OrderStatus {
    return this.cancel(from);
  }

  cancel(from: string): OrderStatus {
    return this.transition(from, OrderStatus.CANCELED);
  }

  markShipperReceived(from: string): OrderStatus {
    return this.transition(from, OrderStatus.SHIPPER_RECEIVED);
  }

  startDelivery(from: string): OrderStatus {
    return this.transition(from, OrderStatus.DELIVERING);
  }

  complete(from: string): OrderStatus {
    return this.transition(from, OrderStatus.COMPLETED);
  }

  startPayment(from: string): OrderStatus {
    const currentStatus = parseOrderStatus(from);
    if (currentStatus !== OrderStatus.PENDING) {
      throw new InvalidOrderTransitionError(currentStatus, OrderStatus.PROCESSING_PAYMENT);
    }
    return OrderStatus.PROCESSING_PAYMENT;
  }

  markPaid(from: string): OrderStatus {
    const currentStatus = parseOrderStatus(from);
    if (currentStatus !== OrderStatus.PENDING && currentStatus !== OrderStatus.PROCESSING_PAYMENT) {
      throw new InvalidOrderTransitionError(currentStatus, OrderStatus.COMPLETED);
    }
    return OrderStatus.COMPLETED;
  }
}

// ==========================================
// 2. ORDER PRICING SERVICE
// ==========================================

export interface OrderPricingToppingSnapshot {
  readonly id: string;
  readonly unitPrice: number;
}

export interface OrderPricingItemSnapshot {
  readonly foodId: string;
  readonly unitPrice: number;
  readonly discountPercent: number;
  readonly quantity: number;
  readonly toppings: readonly OrderPricingToppingSnapshot[];
}

export interface OrderPricingInput {
  readonly items: readonly OrderPricingItemSnapshot[];
  readonly shippingFee: number;
  readonly promotionDiscount: number;
}

export interface OrderPricingResult {
  readonly foodTotal: number;
  readonly shippingFee: number;
  readonly subtotal: number;
  readonly promotionDiscount: number;
  readonly total: number;
}

export class OrderPricingService {
  calculate(input: OrderPricingInput): OrderPricingResult {
    const foodTotal = input.items.reduce((total, item) => {
      const discountPercent = Math.min(100, Math.max(0, item.discountPercent));
      const discountedUnitPrice = item.unitPrice - (item.unitPrice * discountPercent) / 100;
      const toppingsTotal = item.toppings.reduce((sum, topping) => sum + topping.unitPrice, 0);
      return total + Math.round((discountedUnitPrice + toppingsTotal) * item.quantity);
    }, 0);

    const shippingFee = Math.max(0, Math.round(input.shippingFee));
    const subtotal = foodTotal + shippingFee;
    const promotionDiscount = Math.min(subtotal, Math.max(0, Math.round(input.promotionDiscount)));

    return {
      foodTotal,
      shippingFee,
      subtotal,
      promotionDiscount,
      total: Math.max(0, subtotal - promotionDiscount),
    };
  }
}

// ==========================================
// 3. ORDER ITEM SNAPSHOT
// ==========================================

export interface OrderItemToppingSnapshot {
  readonly id: string;
  readonly name: string;
  readonly price: number;
}

export interface OrderItemSnapshot {
  readonly foodId: string;
  readonly foodName: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly toppings: readonly OrderItemToppingSnapshot[];
}

export function createOrderItemSnapshot(input: OrderItemSnapshot): OrderItemSnapshot {
  return Object.freeze({
    foodId: input.foodId,
    foodName: input.foodName,
    unitPrice: input.unitPrice,
    quantity: input.quantity,
    toppings: Object.freeze(input.toppings.map((topping) => Object.freeze({ ...topping }))),
  });
}

// ==========================================
// 4. ORDER ACTOR POLICY
// ==========================================

export interface OrderActorTarget {
  user?: { id: string };
  restaurant?: { owner?: { id: string } };
  shippingDetail?: { shipper?: { id: string } };
}

export class OrderActorPolicy {
  assertCanRead(order: OrderActorTarget, actorId: string, actorRole?: string): void {
    const isAdmin = ['admin', 'administrator', 'super_admin'].includes(actorRole ?? '');
    if (!isAdmin && !this.isParticipant(order, actorId)) {
      throw new ForbiddenException('You cannot access this order');
    }
  }

  assertCanReadUserOrders(targetUserId: string, actorId: string, actorRole?: string): void {
    const isAdmin = ['admin', 'administrator', 'super_admin'].includes(actorRole ?? '');
    if (targetUserId !== actorId && !isAdmin) {
      throw new ForbiddenException("You cannot access another user's orders");
    }
  }

  assertCanDelete(order: OrderActorTarget, actorId: string): void {
    if (order.user?.id !== actorId) {
      throw new ForbiddenException('Only the customer who placed the order can delete it');
    }
  }

  assertCanPay(order: OrderActorTarget, actorId: string): void {
    if (order.user?.id !== actorId) {
      throw new ForbiddenException('Only the customer who placed the order can pay for it');
    }
  }

  assertCanManageRestaurantOrder(order: OrderActorTarget, actorId: string): void {
    if (order.restaurant?.owner?.id !== actorId) {
      throw new ForbiddenException('You can only update orders for your own restaurant');
    }
  }

  private isParticipant(order: OrderActorTarget, actorId: string): boolean {
    return (
      order.user?.id === actorId ||
      order.restaurant?.owner?.id === actorId ||
      order.shippingDetail?.shipper?.id === actorId
    );
  }
}

// ==========================================
// 5. ORDER CORE QUERY SERVICE
// ==========================================

export interface ReviewInfo {
  hasReviewedFood: boolean;
  hasReviewedShipper: boolean;
  foodReviews: Array<{
    id: string;
    foodId: string;
    rating: number;
    comment: string;
    createdAt: Date;
  }>;
  shipperReview: {
    id: string;
    rating: number;
    comment: string;
    createdAt: Date;
  } | null;
  canReviewFood: boolean;
  canReviewShipper: boolean;
}

@Injectable()
export class OrderCoreService {
  readonly stateMachine = new OrderStateMachine();
  readonly pricingService = new OrderPricingService();
  readonly actorPolicy = new OrderActorPolicy();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @Inject(ORDER_REVIEW_READER)
    private readonly orderReviewReader: OrderReviewReaderPort,
  ) {}

  async getOrderById(id: string, includeReviewInfo = false): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
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

    if (includeReviewInfo) {
      const reviewSummary = await this.orderReviewReader.findOrderReviewSummary({
        customerId: order.user.id,
        foodIds: order.orderDetails.map((detail) => detail.food.id),
        shipperId: order.shippingDetail?.shipper?.id ?? null,
      });

      const orderWithReviewInfo = order as Order & { reviewInfo: ReviewInfo };
      orderWithReviewInfo.reviewInfo = {
        hasReviewedFood: reviewSummary.foodReviews.length > 0,
        hasReviewedShipper: Boolean(reviewSummary.shipperReview),
        foodReviews: [...reviewSummary.foodReviews],
        shipperReview: reviewSummary.shipperReview,
        canReviewFood: order.status === 'completed' && reviewSummary.foodReviews.length === 0,
        canReviewShipper:
          order.status === 'completed' &&
          Boolean(order.shippingDetail?.shipper && !reviewSummary.shipperReview),
      };
    }

    return this.cleanSensitiveData(order);
  }

  async getOrderDetails(id: string): Promise<OrderDetail[]> {
    const order = await this.getOrderById(id);
    return order.orderDetails ?? [];
  }

  async getAnalyticsSnapshot(orderId: string): Promise<OrderAnalyticsSnapshot> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
      relations: ['user', 'restaurant', 'shippingDetail', 'shippingDetail.shipper'],
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.toAnalyticsSnapshot(order);
  }

  async getAnalyticsSnapshots(page = 1, pageSize = 200): Promise<OrderAnalyticsPage> {
    const safePage = Math.max(1, page);
    const safePageSize = Math.min(Math.max(1, pageSize), 500);
    const [orders, totalItems] = await this.orderRepository.findAndCount({
      relations: ['user', 'restaurant', 'shippingDetail', 'shippingDetail.shipper'],
      order: { createdAt: 'ASC' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    });
    return {
      items: orders.map((order) => this.toAnalyticsSnapshot(order)),
      page: safePage,
      pageSize: safePageSize,
      totalItems,
      totalPages: Math.ceil(totalItems / safePageSize),
    };
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
      if (order.user.address) {
        order.user.address.forEach((address) => {
          this.removeFields(address, ['latitude', 'longitude']);
        });
      }
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
      if (detail.food) {
        this.removeFields(detail.food, ['soldCount', 'purchasedNumber']);
      }
    });

    if (order.shippingDetail?.shipper) {
      const shipper = order.shippingDetail.shipper;
      this.removeFields(shipper, [
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

  private toAnalyticsSnapshot(order: Order): OrderAnalyticsSnapshot {
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

  private removeFields(target: object, fields: readonly string[]): void {
    for (const field of fields) {
      Reflect.deleteProperty(target, field);
    }
  }
}
