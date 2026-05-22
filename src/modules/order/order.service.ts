import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { User } from 'src/entities/user.entity';
import { Address } from 'src/entities/address.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { PaymentDto } from './dto/payment.dto';
import { PendingAssignmentService } from 'src/queue/pending-assignment.service';
import { Review } from 'src/entities/review.entity';
import { ShippingDetail } from 'src/entities/shippingDetail.entity';
import { SystemConstraintsService } from 'src/services/system-constraints.service';
import { DeliveryRouteService } from './delivery-route.service';
import { OrderDetailFactory } from './order-detail.factory';
import { OrderEventService } from './order-event.service';
import { OrderPricingService } from './order-pricing.service';
import { OrderPromotionService } from './order-promotion.service';
import { OrderSanitizer } from './order-sanitizer';
import { OrderValidationService } from './order-validation.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
    private dataSource: DataSource,
    private pendingAssignmentService: PendingAssignmentService,
    @InjectRepository(Review)
    private reviewRepository: Repository<Review>,
    @InjectRepository(ShippingDetail)
    private shippingDetailRepository: Repository<ShippingDetail>,
    private readonly systemConstraintsService: SystemConstraintsService,
    private readonly deliveryRouteService: DeliveryRouteService,
    private readonly orderDetailFactory: OrderDetailFactory,
    private readonly orderEventService: OrderEventService,
    private readonly orderPricingService: OrderPricingService,
    private readonly orderPromotionService: OrderPromotionService,
    private readonly orderSanitizer: OrderSanitizer,
    private readonly orderValidationService: OrderValidationService,
  ) {}

  /**
   * Create a temporary address for custom delivery locations
   */
  async createTemporaryAddress(
    addressData: {
      street: string;
      ward: string;
      district: string;
      city: string;
      latitude: number;
      longitude: number;
      label?: string;
    },
    userId: string,
  ): Promise<string> {
    this.logger.log(`🏠 Creating temporary address for user ${userId}`);
    this.logger.log(`📍 Address data: ${JSON.stringify(addressData)}`);

    // Validate coordinates
    const lat = Number(addressData.latitude);
    const lng = Number(addressData.longitude);

    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new BadRequestException(
        `Invalid coordinates: lat=${lat}, lng=${lng}`,
      );
    }

    // Create the address record
    const address = new Address();
    address.user = { id: userId } as User;
    address.street = addressData.street;
    address.ward = addressData.ward;
    address.district = addressData.district;
    address.city = addressData.city;
    address.latitude = lat;
    address.longitude = lng;
    address.label = addressData.label || 'Địa chỉ tùy chỉnh';
    address.isDefault = false;
    address.isTemporary = true; // Mark as temporary

    const savedAddress = await this.addressRepository.save(address);

    this.logger.log(`✅ Temporary address created: ${savedAddress.id}`);
    this.logger.log(
      `📍 Coordinates: ${savedAddress.latitude}, ${savedAddress.longitude}`,
    );

    return savedAddress.id;
  }

  /**
   * Delete a temporary address
   */
  async deleteTemporaryAddress(addressId: string): Promise<void> {
    try {
      const address = await this.addressRepository.findOne({
        where: { id: addressId, isTemporary: true },
      });

      if (address) {
        await this.addressRepository.remove(address);
        this.logger.log(`🗑️ Temporary address ${addressId} deleted`);
      }
    } catch (error) {
      this.logger.error(
        `❌ Failed to delete temporary address ${addressId}: ${error.message}`,
      );
    }
  }

  async createOrder(data: CreateOrderDto) {
    this.logger.log(`Starting enhanced order creation for user ${data.userId}`);
    this.logger.log(`Using address ID: ${data.addressId}`);

    const constraints = await this.systemConstraintsService.getConstraints();
    this.orderValidationService.validateOrderHasItems(data.orderDetails);

    const { user, restaurant, address } =
      await this.orderValidationService.validateOrderContext(
        data.userId,
        data.restaurantId,
        data.addressId,
      );
    const coordinates = this.orderValidationService.validateCoordinates(
      address,
      restaurant,
      data.userId,
    );
    const route = await this.deliveryRouteService.calculateBikeRoute(
      coordinates.restaurantLat,
      coordinates.restaurantLng,
      coordinates.userLat,
      coordinates.userLng,
    );
    await this.deliveryRouteService.ensureDistanceWithinLimits(
      route.distance,
      constraints.max_delivery_distance,
    );

    const { foodDetails } =
      await this.orderValidationService.validateAndCalculateOrderDetails(
        data.orderDetails,
      );
    const orderCalculation =
      await this.orderPricingService.calculateOrderWithConstraints({
        items: data.orderDetails.map((item) => ({
          foodId: item.foodId,
          quantity: Number(item.quantity),
          toppings: item.selectedToppings,
          discountPercent: item.discountPercent,
        })),
        promotionCode: data.promotionCode,
        deliveryDistance: route.distance,
        estimatedDeliveryTime: route.estimatedDeliveryTime,
      });

    if (data.promotionCode && orderCalculation.promotionError) {
      throw new BadRequestException(orderCalculation.promotionError);
    }

    const scheduled = this.orderValidationService.validateScheduledDelivery(
      data.deliveryType,
      data.requestedDeliveryTime,
      constraints.max_delivery_time_min,
    );
    const estimatedDeliveryTime =
      scheduled.estimatedDeliveryTime ?? orderCalculation.estimatedDeliveryTime;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const order = new Order();
      order.user = user;
      order.restaurant = restaurant;
      order.total = orderCalculation.total;
      order.note = data.note || '';
      order.address = address;
      order.date = new Date().toISOString();
      order.deliveryDistance = route.distance;
      order.shippingFee = orderCalculation.shippingFee;
      order.estimatedDeliveryTime = estimatedDeliveryTime;
      order.deliveryType = data.deliveryType || 'asap';
      order.requestedDeliveryTime = scheduled.requestedDeliveryTime;
      order.paymentMethod = data.paymentMethod || 'cod';
      order.status =
        data.paymentMethod && data.paymentMethod !== 'cod'
          ? 'processing_payment'
          : 'pending';

      if (data.promotionCode && orderCalculation.appliedPromotion) {
        const promotion = await queryRunner.manager.findOne(Promotion, {
          where: { code: data.promotionCode },
        });
        if (!promotion) {
          throw new NotFoundException(
            `Promotion with code ${data.promotionCode} not found`,
          );
        }
        order.promotionCode = promotion;
      }

      const savedOrder = await queryRunner.manager.save(Order, order);
      await this.orderDetailFactory.createMany(
        savedOrder,
        foodDetails,
        queryRunner.manager,
      );

      if (order.promotionCode) {
        await this.orderPromotionService.usePromotion(
          order.promotionCode.code,
          orderCalculation.subtotal,
        );
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Enhanced order transaction committed for order ID: ${savedOrder.id}`,
      );
      return await this.getOrderById(savedOrder.id);
    } catch (error) {
      this.logger.error(
        `Enhanced order creation failed: ${error.message}`,
        error.stack,
      );
      if (queryRunner.isTransactionActive)
        await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAllOrders() {
    const orders = await this.orderRepository.find({
      relations: [
        'user',
        'restaurant',
        'orderDetails',
        'orderDetails.food',
        'shippingDetail',
        'shippingDetail.shipper', // Add this line to include shipper info
        'promotionCode',
        'address',
      ],
    });

    // Clean sensitive data from all orders
    const cleanedOrders = orders.map((order) => {
      this.orderSanitizer.cleanSensitiveData(order);
      return order;
    });

    return cleanedOrders;
  }

  async getOrderById(
    id: string,
    includeReviewInfo: boolean = false,
  ): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: [
        'user',
        'user.role',
        'user.address',
        'restaurant',
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

    // The 'shippingDetail' relation from Order entity should already load this if it exists.
    // This explicit find is redundant if the relation is set up correctly but safe to keep.
    if (!order.shippingDetail) {
      const shippingDetail = await this.shippingDetailRepository.findOne({
        where: { order: { id: order.id } },
        relations: ['shipper'],
      });
      if (shippingDetail) order.shippingDetail = shippingDetail;
    }

    // Add review information BEFORE cleaning sensitive data
    if (includeReviewInfo) {
      // Check if user has reviewed the food items in this order
      const foodReviews = await this.reviewRepository.find({
        where: {
          user: { id: order.user.id },
          food: { id: In(order.orderDetails.map((detail) => detail.food.id)) },
          type: 'food',
        },
        relations: ['food'],
      });

      // Check if user has reviewed the shipper (if order has shipper)
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

      // Add review information to the order object
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
          order.status === 'completed' &&
          order.shippingDetail?.shipper &&
          !shipperReview,
      };
    }

    // Clean sensitive data AFTER adding review info
    this.orderSanitizer.cleanSensitiveData(order);

    return order;
  }

  // Add a new method specifically for getting order with review info
  async getOrderByIdWithReviews(id: string) {
    return this.getOrderById(id, true);
  }

  async getOrdersByUser(
    userId: string,
    page: number = 1,
    pageSize: number = 10,
    status?: string,
  ) {
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

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    query.skip((page - 1) * pageSize).take(pageSize);

    const [items, totalItems] = await query.getManyAndCount();

    return {
      items,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }
  async getOrdersByRestaurant(
    restaurantId: string,
    page: number = 1,
    pageSize: number = 10,
    status?: string,
  ) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.user', 'user')
      .leftJoinAndSelect('order.restaurant', 'restaurant')
      .leftJoinAndSelect('order.address', 'address')
      .leftJoinAndSelect('order.orderDetails', 'orderDetails')
      .leftJoinAndSelect('orderDetails.food', 'food')
      .leftJoinAndSelect('food.category', 'category')
      .leftJoinAndSelect('order.shippingDetail', 'shippingDetail') // Add this line
      .leftJoinAndSelect('shippingDetail.shipper', 'shipper') // Add this line to include shipper info
      .where('order.restaurant.id = :restaurantId', { restaurantId })
      .orderBy('order.createdAt', 'DESC');

    if (status) {
      query.andWhere('order.status = :status', { status });
    }

    const [items, totalItems] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // Clean sensitive data from the results
    const cleanedItems = items.map((order) => {
      this.orderSanitizer.cleanSensitiveData(order);
      return order;
    });

    return {
      items: cleanedItems,
      totalItems,
      page,
      pageSize,
      totalPages: Math.ceil(totalItems / pageSize),
    };
  }
  async updateOrderStatus(id: string, status: string) {
    const order = await this.getOrderById(id);

    // Validate status transitions
    const validStatuses = [
      'pending',
      'confirmed',
      'delivering',
      'completed',
      'canceled',
      'processing_payment',
    ];
    if (!validStatuses.includes(status)) {
      throw new BadRequestException(
        `Invalid status. Valid values are: ${validStatuses.join(', ')}`,
      );
    }

    // Check if status transition is valid
    const currentStatus = order.status;
    const validTransitions: Record<string, string[]> = {
      pending: ['confirmed', 'canceled'],
      confirmed: ['delivering', 'canceled'],
      delivering: ['completed', 'canceled'],
      processing_payment: ['pending', 'canceled'],
    };

    if (
      validTransitions[currentStatus] &&
      !validTransitions[currentStatus].includes(status)
    ) {
      throw new BadRequestException(
        `Cannot change status from ${currentStatus} to ${status}`,
      );
    }

    order.status = status;
    const updatedOrder = await this.orderRepository.save(order);

    await this.orderEventService.publishOrderStatusUpdated(updatedOrder);

    this.logger.log(`Order ${id} status updated to ${status}`);

    await this.orderEventService.createStatusNotification(order, status);

    return updatedOrder;
  }

  async confirmOrder(
    orderId: string,
    restaurantOwnerId: string,
  ): Promise<Order> {
    this.logger.log(
      `Confirming order ${orderId} for restaurant owner ${restaurantOwnerId}`,
    );

    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Only confirm if order is in pending state
    if (order.status !== 'pending') {
      throw new BadRequestException(`Order is not in a confirmable state`);
    }

    // Update order status
    order.status = 'confirmed';
    const confirmedOrder = await this.orderRepository.save(order);

    this.logger.log(`Order ${orderId} status updated to confirmed`);

    try {
      // Create pending shipper assignment - this will be picked up by the automated system
      const pendingAssignment =
        await this.pendingAssignmentService.addPendingAssignment(
          confirmedOrder.id,
          1, // Priority: 1 = normal, higher numbers = higher priority
        );

      this.logger.log(
        `Created pending shipper assignment ${pendingAssignment.id} for order ${orderId}`,
      );
      this.logger.log(
        `Automated system will find and notify nearby shippers for order ${orderId}`,
      );

      return confirmedOrder;
    } catch (error) {
      this.logger.error(
        `Failed to create pending shipper assignment for order ${orderId}:`,
        error,
      );

      // Don't fail the order confirmation, just log the error
      // The assignment can be created manually or through retry mechanisms
      this.logger.warn(
        `Order ${orderId} confirmed but shipper assignment failed - manual intervention may be required`,
      );

      return confirmedOrder;
    }
  }

  async calculateOrder(data: {
    addressId: string;
    restaurantId: string;
    items: {
      foodId: string;
      quantity: number;
      discountPercent?: number;
      toppings?: { id: string; price: number }[];
    }[];
    promotionCode?: string;
  }) {
    this.logger.log('Calculate order with Mapbox');
    const { address, restaurant } =
      await this.orderValidationService.validateAddressAndRestaurant(
        data.addressId,
        data.restaurantId,
      );
    const coordinates = this.orderValidationService.validateCoordinates(
      address,
      restaurant,
    );
    const route = await this.deliveryRouteService.calculateBikeRoute(
      coordinates.restaurantLat,
      coordinates.restaurantLng,
      coordinates.userLat,
      coordinates.userLng,
    );

    return this.orderPricingService.calculateOrderWithConstraints({
      ...data,
      deliveryDistance: route.distance,
      estimatedDeliveryTime: route.estimatedDeliveryTime,
    });
  }

  async calculateOrderWithCustomAddress(
    address: {
      street: string;
      ward: string;
      district: string;
      city: string;
      latitude: number;
      longitude: number;
      label?: string;
    },
    restaurantId: string,
    items: {
      foodId: string;
      quantity: number;
      discountPercent?: number;
      toppings?: { id: string; price: number }[];
    }[],
    promotionCode?: string,
  ) {
    const restaurant =
      await this.orderValidationService.validateRestaurant(restaurantId);
    const route = await this.deliveryRouteService.calculateBikeRoute(
      Number(restaurant.address.latitude),
      Number(restaurant.address.longitude),
      Number(address.latitude),
      Number(address.longitude),
    );

    this.logger.log(
      `Custom address route: ${route.distance}km, ${route.estimatedDeliveryTime} minutes`,
    );

    return this.orderPricingService.calculateCustomAddressOrder({
      items,
      promotionCode,
      deliveryDistance: route.distance,
      estimatedDeliveryTime: route.estimatedDeliveryTime,
    });
  }

  async deleteOrder(id: string) {
    // First make sure the order exists
    const order = await this.getOrderById(id);

    // Use a transaction for deleting order and details
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Delete associated order details
      if (order.orderDetails && order.orderDetails.length > 0) {
        await queryRunner.manager.delete(OrderDetail, {
          order: { id: order.id },
        });
      }

      // Delete the order
      await queryRunner.manager.delete(Order, id);

      await queryRunner.commitTransaction();

      return { message: 'Order and its details deleted successfully' };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async processPayment(orderId: string, paymentData: PaymentDto) {
    const order = await this.getOrderById(orderId);

    if (order.status !== 'pending') {
      throw new BadRequestException(
        'Cannot process payment for an order that is not pending',
      );
    }

    // Use a transaction for payment processing
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Validate payment data
      if (!paymentData.method) {
        throw new BadRequestException('Payment method is required');
      }

      // Here you would integrate with a real payment gateway
      // For demonstration, we'll just simulate different payment results

      let paymentSuccess = true;
      let paymentMessage = 'Payment processed successfully';

      // Simulate payment processing based on method
      switch (paymentData.method) {
        case 'credit_card':
          // Validate credit card info
          if (
            !paymentData.cardNumber ||
            !paymentData.expiryDate ||
            !paymentData.cvv
          ) {
            throw new BadRequestException(
              'Credit card information is incomplete',
            );
          }
          // Additional validation would happen here in a real system
          break;

        case 'paypal':
          // Verify paypal token or account
          if (!paymentData.paypalToken) {
            throw new BadRequestException('PayPal token is required');
          }
          break;

        case 'cash':
          // Cash on delivery, no validation needed
          break;

        default:
          throw new BadRequestException('Unsupported payment method');
      }

      // Update order status based on payment result
      if (paymentSuccess) {
        // For cash payments, set to processing
        if (paymentData.method === 'cash') {
          order.status = 'processing';
        } else {
          // For electronic payments, you might set to 'paid' or 'processing'
          order.status = 'processing';
        }

        // Store payment details (in a real system, this would be in a Payment entity)
        order.paymentMethod = paymentData.method;
        order.paymentDate = new Date().toISOString();

        await this.orderRepository.save(order);

        await queryRunner.commitTransaction();

        return {
          success: true,
          message: paymentMessage,
          order: await this.getOrderById(orderId),
        };
      } else {
        throw new BadRequestException('Payment failed');
      }
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
  // Get order details for a specific order
  async getOrderDetails(orderId: string) {
    const order = await this.getOrderById(orderId);
    return order.orderDetails;
  }
  /**
   * Confirm payment for an order
   * @param orderId The ID of the order to confirm payment for
   * @returns The updated order
   */
  async confirmPayment(orderId: string): Promise<Order> {
    this.logger.log(`Confirming payment for order ${orderId}`);

    const order = await this.getOrderById(orderId);

    if (!order) {
      throw new NotFoundException(`Order with ID ${orderId} not found`);
    }

    // Only confirm payment if order is in pending or processing status
    if (order.status !== 'pending' && order.status !== 'processing') {
      throw new BadRequestException(
        `Cannot confirm payment for an order with status ${order.status}`,
      );
    }

    // Update order status and payment details
    order.status = 'completed';
    order.isPaid = true;
    order.paymentDate = new Date().toISOString();

    // Save the updated order
    const updatedOrder = await this.orderRepository.save(order);

    await this.orderEventService.publishOrderCreated(updatedOrder);
    await this.orderEventService.publishOrderStatusUpdated(updatedOrder);

    this.logger.log(
      `Payment confirmed for order ${orderId} - orderCreated event published`,
    );

    return updatedOrder;
  }

  // Add method to validate promotion for an order
  async validatePromotionForOrder(
    promotionCode: string,
    addressId: string,
    restaurantId: string,
    items: { foodId: string; quantity: number }[],
  ) {
    const orderCalculation = await this.calculateOrder({
      addressId,
      restaurantId,
      items,
      promotionCode,
    });

    return {
      valid: !orderCalculation.promotionError,
      promotion: orderCalculation.appliedPromotion,
      discount: orderCalculation.promotionDiscount,
      error: orderCalculation.promotionError,
      orderTotal: orderCalculation.total,
    };
  }

  async getMinimalOrderHistoryForQuickReorder(userId: string, limit = 3) {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderDetails', 'orderDetail')
      .leftJoinAndSelect('orderDetail.food', 'food')
      .leftJoinAndSelect('food.restaurant', 'restaurant')
      .where('order.user_id = :userId', { userId })
      .orderBy('order.createdAt', 'DESC')
      .take(limit);

    const orders = await query.getMany();

    const quickOrders = orders.map((order) => ({
      orderId: order.id,
      restaurantId: order.orderDetails?.[0]?.food?.restaurant?.id,
      totalAmount: order.total,
      orderDetails: order.orderDetails.map((detail) => ({
        foodName: detail.food?.name,
        quantity: detail.quantity,
        price: detail.price,
      })),
    }));

    return quickOrders;
  }

  async getOrderHistory(
    userId: string,
    page: number = 1,
    pageSize: number = 10,
  ) {
    // Tạo query để lấy các đơn hàng của người dùng
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.orderDetails', 'orderDetail') // Lấy thông tin chi tiết món ăn
      .leftJoinAndSelect('orderDetail.food', 'food') // Lấy thông tin món ăn từ orderDetails
      .where('order.user_id = :userId', { userId })
      .orderBy('order.createdAt', 'DESC'); // Sắp xếp theo ngày tạo đơn hàng (mới nhất lên đầu)

    // Áp dụng phân trang
    const [orders, totalOrders] = await query
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    // Chuyển đổi và trả về dữ liệu
    const ordersHistory = orders.map((order) => ({
      orderId: order.id,
      restaurantName: order.restaurant?.name,
      totalAmount: order.total,
      status: order.status,
      date: order.createdAt,
      orderDetails: order.orderDetails.map((orderDetail) => ({
        foodName: orderDetail.food.name,
        quantity: orderDetail.quantity,
        price: orderDetail.price,
        totalPrice: (
          parseFloat(orderDetail.price) * orderDetail.quantity
        ).toFixed(2),
      })),
    }));

    return {
      items: ordersHistory,
      totalItems: totalOrders,
      page,
      pageSize,
      totalPages: Math.ceil(totalOrders / pageSize),
    };
  }
}
