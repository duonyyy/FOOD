import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Food } from 'src/entities/food.entity';
import { Order } from 'src/entities/order.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Review } from 'src/entities/review.entity';
import { Role } from 'src/entities/role.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { User } from 'src/entities/user.entity';
import { In, Repository } from 'typeorm';
import type { OrderAnalyticsPage, OrderAnalyticsSnapshot } from '../../features/orders/contracts/order-analytics-reader.port';

interface ReviewInfo {
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
  canReviewShipper: boolean | undefined;
}

@Injectable()
export class OrderQueryService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
    @InjectRepository(ShippingDetail)
    private readonly shippingDetailRepository: Repository<ShippingDetail>,
  ) {}

  async getAllOrders() {
    const orders = await this.orderRepository.find({
      relations: [
        'user',
        'restaurant',
        'orderDetails',
        'orderDetails.food',
        'shippingDetail',
        'shippingDetail.shipper',
        'promotionCode',
        'address',
      ],
    });

    return orders.map((order) => this.cleanSensitiveData(order));
  }

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

    if (!order.shippingDetail) {
      const shippingDetail = await this.shippingDetailRepository.findOne({
        where: { order: { id: order.id } },
        relations: ['shipper'],
      });
      if (shippingDetail) order.shippingDetail = shippingDetail;
    }

    if (includeReviewInfo) {
      const foodReviews = await this.reviewRepository.find({
        where: {
          user: { id: order.user.id },
          food: { id: In(order.orderDetails.map((detail) => detail.food.id)) },
          type: 'food',
        },
        relations: ['food'],
      });

      let shipperReview: Review | null = null;
      if (order.shippingDetail?.shipper) {
        shipperReview = await this.reviewRepository.findOne({
          where: {
            user: { id: order.user.id },
            shipper: { id: order.shippingDetail.shipper.id },
            type: 'shipper',
          },
        });
      }

      const orderWithReviewInfo = order as Order & { reviewInfo: ReviewInfo };
      orderWithReviewInfo.reviewInfo = {
        hasReviewedFood: foodReviews.length > 0,
        hasReviewedShipper: !!shipperReview,
        foodReviews: foodReviews.map((review) => ({
          id: review.id,
          foodId: review.food.id,
          rating: review.rating,
          comment: review.comment,
          createdAt: review.createdAt,
        })),
        shipperReview: shipperReview
          ? {
              id: shipperReview.id,
              rating: shipperReview.rating,
              comment: shipperReview.comment,
              createdAt: shipperReview.createdAt,
            }
          : null,
        canReviewFood: order.status === 'completed' && foodReviews.length === 0,
        canReviewShipper:
          order.status === 'completed' && order.shippingDetail?.shipper && !shipperReview,
      };
    }

    return this.cleanSensitiveData(order);
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

  async getOrdersByUser(userId: string, page = 1, pageSize = 10, status?: string) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.restaurant', 'restaurant')
      .select([
        'order.id',
        'order.status',
        'order.total',
        'order.createdAt',
        'order.paymentMethod',
        'restaurant.id',
        'restaurant.name',
      ])
      .where('order.user = :userId', { userId });

    if (status) query.andWhere('order.status = :status', { status });

    const [items, totalItems] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { items, totalItems, page, pageSize, totalPages: Math.ceil(totalItems / pageSize) };
  }

  async getOrdersByRestaurant(restaurantId: string, page = 1, pageSize = 10, status?: string) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.restaurant', 'restaurant')
      .leftJoinAndSelect('order.address', 'address')
      .leftJoinAndSelect('order.orderDetails', 'orderDetails')
      .leftJoinAndSelect('orderDetails.food', 'food')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoinAndSelect('order.shippingDetail', 'shippingDetail')
      .leftJoinAndSelect('shippingDetail.shipper', 'shipper')
      .where('order.restaurant.id = :restaurantId', { restaurantId })
      .orderBy('order.createdAt', 'DESC');

    if (status) query.andWhere('order.status = :status', { status });

    const [items, totalItems] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return {
      items: items.map((order) => this.cleanSensitiveData(order)),
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }

  async getOrderDetails(orderId: string) {
    const order = await this.getOrderById(orderId);
    return order.orderDetails;
  }

  async getMinimalOrderHistoryForQuickReorder(userId: string, limit = 3) {
    const orders = await this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderDetails', 'orderDetail')
      .leftJoinAndSelect('orderDetail.food', 'food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .where('order.user_id = :userId', { userId })
      .orderBy('order.createdAt', 'DESC')
      .take(limit)
      .getMany();

    return orders.map((order) => ({
      orderId: order.id,
      restaurantId: order.orderDetails?.[0]?.food?.restaurant?.id,
      totalAmount: order.total,
      orderDetails: order.orderDetails.map((detail) => ({
        foodId: detail.food?.id,
        foodName: detail.foodNameSnapshot ?? detail.food?.name,
        quantity: detail.quantity,
        price: detail.unitPriceSnapshot ?? detail.price,
      })),
    }));
  }

  async getOrderHistory(userId: string, page = 1, pageSize = 10) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.restaurant', 'restaurant')
      .leftJoinAndSelect('order.orderDetails', 'orderDetail')
      .leftJoinAndSelect('orderDetail.food', 'food')
      .where('order.user_id = :userId', { userId })
      .orderBy('order.createdAt', 'DESC');

    const [orders, totalOrders] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    const items = orders.map((order) => ({
      orderId: order.id,
      restaurantName: order.restaurant?.name,
      totalAmount: order.total,
      status: order.status,
      date: order.createdAt,
      orderDetails: order.orderDetails.map((detail) => ({
        foodName: detail.foodNameSnapshot ?? detail.food.name,
        quantity: detail.quantity,
        price: detail.unitPriceSnapshot ?? detail.price,
        totalPrice: (Number(detail.unitPriceSnapshot ?? detail.price) * detail.quantity).toFixed(2),
      })),
    }));

    return {
      items,
      totalItems: totalOrders,
      page,
      pageSize,
      totalPages: Math.ceil(totalOrders / pageSize),
    };
  }

  private cleanSensitiveData(order: Order): Order {
    if (order.user) {
      delete (order.user as Partial<User>).password;
      delete (order.user as Partial<User>).resetPasswordToken;
      delete (order.user as Partial<User>).resetPasswordExpires;
      delete (order.user as Partial<User>).birthday;
      delete (order.user as Partial<User>).lastLoginAt;
      delete (order.user as Partial<User>).createdAt;
      delete (order.user as Partial<User>).googleId;
      if (order.user.role) {
        delete (order.user.role as Partial<Role>).isSystem;
        delete (order.user.role as Partial<Role>).description;
        delete (order.user.role as Partial<Role>).createdAt;
        delete (order.user.role as Partial<Role>).updatedAt;
      }
      if (order.user.address) {
        order.user.address.forEach((address) => {
          delete (address as Partial<Address>).latitude;
          delete (address as Partial<Address>).longitude;
        });
      }
    }

    if (order.restaurant) {
      delete (order.restaurant as Partial<Restaurant>).openTime;
      delete (order.restaurant as Partial<Restaurant>).closeTime;
      delete (order.restaurant as Partial<Restaurant>).licenseCode;
      delete (order.restaurant as Partial<Restaurant>).certificateImage;
      delete (order.restaurant as Partial<Restaurant>).updatedAt;
      delete (order.restaurant as Partial<Restaurant>).createdAt;
    }

    order.orderDetails?.forEach((detail) => {
      if (detail.food) {
        delete (detail.food as Partial<Food>).soldCount;
        delete (detail.food as Partial<Food>).purchasedNumber;
      }
    });

    if (order.shippingDetail?.shipper) {
      const shipper = order.shippingDetail.shipper;
      delete (shipper as Partial<User>).password;
      delete (shipper as Partial<User>).resetPasswordToken;
      delete (shipper as Partial<User>).resetPasswordExpires;
      delete (shipper as Partial<User>).email;
      delete (shipper as Partial<User>).birthday;
      delete (shipper as Partial<User>).lastLoginAt;
      delete (shipper as Partial<User>).createdAt;
      delete (shipper as Partial<User>).googleId;
      delete (shipper as Partial<User>).address;
      delete (shipper as Partial<User>).role;
    }

    if (order.promotionCode) {
      delete (order.promotionCode as Partial<Promotion>).maxUsage;
      delete (order.promotionCode as Partial<Promotion>).numberOfUsed;
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
}
