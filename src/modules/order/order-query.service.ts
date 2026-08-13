import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Order } from 'src/entities/order.entity';
import { Review } from 'src/entities/review.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { In, Repository } from 'typeorm';

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

      (order as any).reviewInfo = {
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
        foodName: detail.food?.name,
        quantity: detail.quantity,
        price: detail.price,
      })),
    }));
  }

  async getOrderHistory(userId: string, page = 1, pageSize = 10) {
    const query = this.orderRepository
      .createQueryBuilder('order')
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
        foodName: detail.food.name,
        quantity: detail.quantity,
        price: detail.price,
        totalPrice: (parseFloat(detail.price) * detail.quantity).toFixed(2),
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
      delete (order.user as any).password;
      delete (order.user as any).resetPasswordToken;
      delete (order.user as any).resetPasswordExpires;
      delete (order.user as any).birthday;
      delete (order.user as any).lastLoginAt;
      delete (order.user as any).createdAt;
      delete (order.user as any).googleId;
      if (order.user.role) {
        delete (order.user.role as any).isSystem;
        delete (order.user.role as any).description;
        delete (order.user.role as any).createdAt;
        delete (order.user.role as any).updatedAt;
      }
      if (order.user.address) {
        order.user.address.forEach((address) => {
          delete (address as any).latitude;
          delete (address as any).longitude;
        });
      }
    }

    if (order.restaurant) {
      delete (order.restaurant as any).openTime;
      delete (order.restaurant as any).closeTime;
      delete (order.restaurant as any).licenseCode;
      delete (order.restaurant as any).certificateImage;
      delete (order.restaurant as any).updatedAt;
      delete (order.restaurant as any).createdAt;
    }

    order.orderDetails?.forEach((detail) => {
      if (detail.food) {
        delete (detail.food as any).soldCount;
        delete (detail.food as any).purchasedNumber;
      }
    });

    if (order.shippingDetail?.shipper) {
      const shipper = order.shippingDetail.shipper;
      delete (shipper as any).password;
      delete (shipper as any).resetPasswordToken;
      delete (shipper as any).resetPasswordExpires;
      delete (shipper as any).email;
      delete (shipper as any).birthday;
      delete (shipper as any).lastLoginAt;
      delete (shipper as any).createdAt;
      delete (shipper as any).googleId;
      delete (shipper as any).address;
      delete (shipper as any).role;
    }

    if (order.promotionCode) {
      delete (order.promotionCode as any).usageLimit;
      delete (order.promotionCode as any).usageCount;
      delete (order.promotionCode as any).createdAt;
      delete (order.promotionCode as any).updatedAt;
    }

    return order;
  }
}
