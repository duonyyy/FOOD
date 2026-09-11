import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { ORDER_CREATED_EVENT } from 'src/common/events/order-events';
import { OutboxService } from 'src/common/events/outbox.service';
import { haversineDistance } from 'src/common/utils/geo.util';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import {
  LOCATION_READER,
  LOCATION_WRITER,
  type LocationReaderPort,
  type LocationWriterPort,
} from 'src/features/locations/public-api';
import {
  MENU_READER,
  type MenuReaderPort,
  type OrderableItemSnapshot,
} from 'src/features/menu/public-api';
import { PromotionRedemptionService, PromotionService } from 'src/features/promotions/public-api';
import { RESTAURANT_READER, type RestaurantReaderPort } from 'src/features/restaurants/public-api';
import { SystemConstraintsService } from 'src/features/system-constraints/public-api';
import { IDENTITY_READER, type IdentityReaderPort } from 'src/features/users/public-api';
import { ROUTE_PORT, type RoutePort } from 'src/infra/contracts/route.port';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { CreateOrderDto } from '../dto/create-order.dto';
import { PaymentDto } from '../dto/payment.dto';
import {
  createOrderItemSnapshot,
  InvalidOrderStatusError,
  InvalidOrderTransitionError,
  OrderCoreService,
  OrderPricingItemSnapshot,
  OrderPricingService,
  OrderStateMachine,
} from './order-core.service';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class CustomerOrdersService {
  private readonly logger = new Logger(CustomerOrdersService.name);
  private readonly orderStateMachine = new OrderStateMachine();
  private readonly pricingService = new OrderPricingService();

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderDetail)
    private readonly orderDetailRepository: Repository<OrderDetail>,
    private readonly dataSource: DataSource,
    private readonly promotionService: PromotionService,
    private readonly promotionRedemptionService: PromotionRedemptionService,
    private readonly outboxService: OutboxService,
    private readonly systemConstraintsService: SystemConstraintsService,
    @Inject(ROUTE_PORT)
    private readonly routePort: RoutePort,
    private readonly orderCoreService: OrderCoreService,
    @Inject(MENU_READER)
    private readonly menuReader: MenuReaderPort,
    @Inject(LOCATION_READER)
    private readonly locationReader: LocationReaderPort,
    @Inject(LOCATION_WRITER)
    private readonly locationWriter: LocationWriterPort,
    @Inject(RESTAURANT_READER)
    private readonly restaurantReader: RestaurantReaderPort,
    @Inject(IDENTITY_READER)
    private readonly identityReader: IdentityReaderPort,
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

    const lat = Number(addressData.latitude);
    const lng = Number(addressData.longitude);

    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new BadRequestException(`Invalid coordinates: lat=${lat}, lng=${lng}`);
    }

    const savedAddress = await this.locationWriter.writeAddress(
      {
        ...addressData,
        latitude: lat,
        longitude: lng,
        label: addressData.label || 'Địa chỉ tùy chỉnh',
        isTemporary: true,
      },
      userId,
    );
    this.logger.log(`✅ Temporary address created: ${savedAddress.addressId}`);

    return savedAddress.addressId;
  }

  /**
   * Delete a temporary address
   */
  async deleteTemporaryAddress(addressId: string): Promise<void> {
    try {
      const address = await this.locationReader.findTemporaryAddress(addressId);

      if (address) {
        await this.locationWriter.removeAddress(addressId);
        this.logger.log(`🗑️ Temporary address ${addressId} deleted`);
      }
    } catch (error: unknown) {
      this.logger.error(
        `❌ Failed to delete temporary address ${addressId}: ${errorMessage(error)}`,
      );
    }
  }

  /**
   * Clean up expired temporary addresses (older than 24 hours)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupTemporaryAddresses() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const removedCount = await this.locationWriter.removeExpiredTemporaryAddresses(oneDayAgo);

      if (removedCount > 0) {
        this.logger.log(`🗑️ Cleaned up ${removedCount} temporary addresses older than 24 hours`);
      }
    } catch (error: unknown) {
      this.logger.error(`❌ Failed to cleanup temporary addresses: ${errorMessage(error)}`);
    }
  }

  /**
   * Calculate order prices and shipping fees with a saved address
   */
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
    const [address, restaurant] = await Promise.all([
      this.locationReader.findAddress(data.addressId),
      this.restaurantReader.findActiveRestaurant(data.restaurantId),
    ]);

    if (!address) {
      throw new Error('Invalid address');
    }
    if (!restaurant?.location) {
      throw new BadRequestException('Restaurant is not active or has no delivery location');
    }

    const userLat = Number(address.latitude);
    const userLng = Number(address.longitude);
    const restaurantLat = Number(restaurant.location.latitude);
    const restaurantLng = Number(restaurant.location.longitude);

    const routeResult = await this.calculateDeliveryRoute(
      restaurantLat,
      restaurantLng,
      userLat,
      userLng,
    );

    const deliveryDistance = routeResult.distance;
    const estimatedDeliveryTime = Math.round(routeResult.duration / 60);

    return this.calculateOrderWithConstraints({
      ...data,
      deliveryDistance,
      estimatedDeliveryTime,
    });
  }

  /**
   * Calculate order prices and shipping fees with a custom address
   */
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
    const restaurant = await this.restaurantReader.findActiveRestaurant(restaurantId);

    if (!restaurant?.location) {
      throw new BadRequestException('Restaurant is not active or has no delivery location');
    }

    const routeResult = await this.calculateDeliveryRoute(
      Number(restaurant.location.latitude),
      Number(restaurant.location.longitude),
      Number(address.latitude),
      Number(address.longitude),
    );

    const distance = routeResult.distance;
    const estimatedDeliveryTime = Math.round(routeResult.duration / 60);
    const shippingFee = await this.systemConstraintsService.calculateShippingFee(distance);

    const pricingItems = await this.getPricingItems(
      items.map((item) => ({
        foodId: item.foodId,
        quantity: item.quantity,
        toppingIds: (item.toppings ?? []).map((topping) => topping.id),
      })),
      restaurantId,
    );

    let promotionDiscount = 0;
    let appliedPromotion: NonNullable<
      Awaited<ReturnType<PromotionService['validatePromotion']>>['promotion']
    > | null = null;
    let promotionError: string | null = null;

    if (promotionCode) {
      try {
        const validation = await this.promotionService.validatePromotion(
          promotionCode,
          this.pricingService.calculate({
            items: pricingItems,
            shippingFee,
            promotionDiscount: 0,
          }).subtotal,
        );

        if (validation.valid && validation.promotion) {
          appliedPromotion = validation.promotion;
          if (String(appliedPromotion.type) === 'FOOD_DISCOUNT') {
            promotionDiscount = this.promotionService.calculateDiscount(
              appliedPromotion,
              this.pricingService.calculate({
                items: pricingItems,
                shippingFee: 0,
                promotionDiscount: 0,
              }).foodTotal,
            );
          } else if (String(appliedPromotion.type) === 'SHIPPING_DISCOUNT') {
            promotionDiscount = Math.min(
              this.promotionService.calculateDiscount(appliedPromotion, shippingFee),
              shippingFee,
            );
          }
        } else {
          promotionError = validation.reason || 'Invalid promotion code';
        }
      } catch (error: unknown) {
        promotionError = 'Failed to validate promotion code';
        this.logger.error(`Promotion validation error: ${errorMessage(error)}`);
      }
    }

    const pricing = this.pricingService.calculate({
      items: pricingItems,
      shippingFee,
      promotionDiscount,
    });

    return {
      ...pricing,
      distance,
      estimatedDeliveryTime,
      appliedPromotion: appliedPromotion
        ? {
            id: appliedPromotion.id,
            code: appliedPromotion.code,
            description: appliedPromotion.description,
            type: appliedPromotion.type,
            discountAmount: promotionDiscount,
          }
        : null,
      promotionError,
    };
  }

  /**
   * Internal constrained calculation
   */
  async calculateOrderWithConstraints(data: {
    addressId: string;
    restaurantId: string;
    items: {
      foodId: string;
      quantity: number;
      discountPercent?: number;
      toppings?: { id: string; price: number }[];
    }[];
    promotionCode?: string;
    deliveryDistance: number;
    estimatedDeliveryTime?: number;
  }) {
    const { deliveryDistance } = data;
    const shippingFee = await this.systemConstraintsService.calculateShippingFee(deliveryDistance);
    const maxDeliveryTime = await this.systemConstraintsService.getMaxDeliveryTime();

    const estimatedDeliveryTime =
      data.estimatedDeliveryTime || Math.min(maxDeliveryTime, Math.ceil(deliveryDistance * 2) + 20);

    const shipperCommissionRate = 0.8;
    const shipperEarnings = Math.round(shippingFee * shipperCommissionRate);
    const platformFee = shippingFee - shipperEarnings;

    const pricingItems = await this.getPricingItems(
      data.items.map((item) => ({
        foodId: item.foodId,
        quantity: item.quantity,
        toppingIds: (item.toppings ?? []).map((topping) => topping.id),
      })),
      data.restaurantId,
    );

    let appliedPromotion: NonNullable<
      Awaited<ReturnType<PromotionService['validatePromotion']>>['promotion']
    > | null = null;
    let promotionDiscount = 0;
    let promotionError: string | null = null;
    const subtotal = this.pricingService.calculate({
      items: pricingItems,
      shippingFee,
      promotionDiscount: 0,
    }).subtotal;

    if (data.promotionCode) {
      const validation = await this.promotionService.validatePromotion(
        data.promotionCode,
        subtotal,
      );
      if (validation.valid && validation.promotion) {
        appliedPromotion = validation.promotion;
        promotionDiscount = validation.calculatedDiscount || 0;
      } else {
        promotionError = validation.reason || 'Invalid promotion code.';
      }
    }

    const pricing = this.pricingService.calculate({
      items: pricingItems,
      shippingFee,
      promotionDiscount,
    });

    return {
      ...pricing,
      shipperEarnings,
      shipperCommissionRate,
      platformFee,
      distance: Number(deliveryDistance.toFixed(2)),
      estimatedDeliveryTime,
      appliedPromotion,
      promotionError,
    };
  }

  /**
   * Validate promotion code for an order
   */
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

  /**
   * Create an order with transactional boundary, outbox event and promotion redemption
   */
  async createOrder(data: CreateOrderDto) {
    this.logger.log(`Starting order creation for customer ${data.userId}`);

    if (!data.orderDetails || data.orderDetails.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const constraints = await this.systemConstraintsService.getConstraints();
    const [user, restaurant, address] = await Promise.all([
      this.identityReader.findIdentityUser(data.userId),
      this.restaurantReader.findActiveRestaurant(data.restaurantId),
      this.locationReader.findOwnedAddress(data.addressId, data.userId),
    ]);

    if (!user) throw new NotFoundException('User not found');
    if (!restaurant?.location) {
      throw new NotFoundException('Restaurant or its address not found');
    }
    if (!address) throw new NotFoundException('Delivery address not found');

    if (address.latitude === null || address.longitude === null) {
      throw new BadRequestException(
        'Delivery address coordinates are missing. Please select a valid address or provide coordinates.',
      );
    }
    if (restaurant.location.latitude === null || restaurant.location.longitude === null) {
      throw new BadRequestException('Restaurant coordinates are missing. Please contact support.');
    }

    const userLat = Number(address.latitude);
    const userLng = Number(address.longitude);
    const restaurantLat = Number(restaurant.location.latitude);
    const restaurantLng = Number(restaurant.location.longitude);
    if (Math.abs(userLat) > 90 || Math.abs(userLng) > 180) {
      throw new BadRequestException(`Invalid user coordinates: lat=${userLat}, lng=${userLng}`);
    }
    if (Math.abs(restaurantLat) > 90 || Math.abs(restaurantLng) > 180) {
      throw new BadRequestException(
        `Invalid restaurant coordinates: lat=${restaurantLat}, lng=${restaurantLng}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    let outboxEventId: string | null = null;

    try {
      const routeResult = await this.calculateDeliveryRoute(
        restaurantLat,
        restaurantLng,
        userLat,
        userLng,
      );
      const deliveryDistance = routeResult.distance;
      const mapboxEstimatedDeliveryTime = Math.round(routeResult.duration / 60);

      if (!(await this.systemConstraintsService.isDistanceWithinLimits(deliveryDistance))) {
        throw new BadRequestException(
          `Delivery distance of ${deliveryDistance}km exceeds the maximum of ${constraints.max_delivery_distance}km.`,
        );
      }

      const { foodDetails } = await this.validateAndCalculateOrderDetails(
        data.orderDetails,
        data.restaurantId,
      );
      const orderCalculation = await this.calculateOrderWithConstraints({
        addressId: data.addressId,
        restaurantId: data.restaurantId,
        items: data.orderDetails.map((item) => ({
          foodId: item.foodId,
          quantity: Number(item.quantity),
          toppings: item.selectedToppings,
          discountPercent: item.discountPercent,
        })),
        promotionCode: data.promotionCode,
        deliveryDistance,
        estimatedDeliveryTime: mapboxEstimatedDeliveryTime,
      });

      if (data.promotionCode && orderCalculation.promotionError) {
        throw new BadRequestException(orderCalculation.promotionError);
      }

      let validatedDeliveryTime: Date | null = null;
      let estimatedDeliveryTime = orderCalculation.estimatedDeliveryTime;
      if (data.deliveryType === 'scheduled' && data.requestedDeliveryTime) {
        if (data.requestedDeliveryTime > constraints.max_delivery_time_min) {
          throw new BadRequestException(
            `Scheduled time cannot exceed ${constraints.max_delivery_time_min} minutes.`,
          );
        }
        validatedDeliveryTime = new Date(Date.now() + data.requestedDeliveryTime * 60000);
        estimatedDeliveryTime = data.requestedDeliveryTime;
      }

      const order = new Order();
      order.user = { id: user.userId } as Order['user'];
      order.restaurant = { id: restaurant.restaurantId } as Order['restaurant'];
      order.total = orderCalculation.total;
      order.note = data.note || '';
      order.address = { id: address.addressId } as Order['address'];
      order.date = new Date().toISOString();
      order.deliveryDistance = deliveryDistance;
      order.shippingFee = orderCalculation.shippingFee;
      order.estimatedDeliveryTime = estimatedDeliveryTime;
      order.deliveryType = data.deliveryType || 'asap';
      order.requestedDeliveryTime = validatedDeliveryTime?.toISOString();
      order.paymentMethod = data.paymentMethod || 'cod';
      order.status =
        data.paymentMethod && data.paymentMethod !== 'cod' ? 'processing_payment' : 'pending';

      const savedOrder = await queryRunner.manager.save(Order, order);
      await this.createOrderDetails(savedOrder, foodDetails, queryRunner);

      if (data.promotionCode && orderCalculation.appliedPromotion) {
        const redemption = await this.promotionRedemptionService.redeemInTransaction(
          {
            orderId: savedOrder.id,
            promotionCode: data.promotionCode,
            customerId: data.userId,
            subtotal: orderCalculation.subtotal,
            discountAmount: orderCalculation.promotionDiscount,
          },
          queryRunner.manager,
        );
        order.promotionCode = { id: redemption.promotion.id } as Order['promotionCode'];
        await queryRunner.manager.save(Order, order);
      }

      const outboxEvent = await this.outboxService.enqueue(queryRunner.manager, {
        eventType: ORDER_CREATED_EVENT,
        aggregateType: 'Order',
        aggregateId: savedOrder.id,
        idempotencyKey: `Order:${savedOrder.id}:created`,
        payload: {
          orderId: savedOrder.id,
          customerId: data.userId,
          status: savedOrder.status,
          occurredAt: new Date().toISOString(),
        },
      });
      outboxEventId = outboxEvent.id;

      await queryRunner.commitTransaction();

      if (outboxEventId) {
        try {
          await this.outboxService.dispatchAfterCommit(outboxEventId);
        } catch (dispatchError) {
          this.logger.warn(
            `Order committed but outbox dispatch failed: ${(dispatchError as Error).message}`,
          );
        }
      }
      if (data.promotionCode && orderCalculation.appliedPromotion) {
        try {
          await this.promotionService.clearPromotionCache();
        } catch (cacheError) {
          this.logger.warn(
            `Order committed but promotion cache invalidation failed: ${(cacheError as Error).message}`,
          );
        }
      }

      return this.orderCoreService.getOrderById(savedOrder.id);
    } catch (error) {
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  private async validateAndCalculateOrderDetails(
    orderDetails: CreateOrderDto['orderDetails'],
    restaurantId: string,
  ) {
    let calculatedTotal = 0;
    const foodDetails: Array<{
      foodId: string;
      foodName: string;
      quantity: number;
      selectedToppings?: { id: string; name: string; price: number }[];
      toppingTotal: number;
      discountPercent: number;
      discountedPrice: number;
      itemTotal: number;
    }> = [];

    const menuItems = await this.getOrderableItems(
      orderDetails.map((detail) => ({
        foodId: detail.foodId,
        quantity: Number(detail.quantity),
        toppingIds: (detail.selectedToppings ?? []).map((topping) => topping.id),
      })),
      restaurantId,
    );

    for (const [index, detail] of orderDetails.entries()) {
      const food = menuItems[index];
      const quantity = Number(detail.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        throw new BadRequestException(`Invalid quantity for food ID ${detail.foodId}`);
      }

      const basePrice = food.unitPrice;
      const discountPercent = food.discountPercent;
      const discountedPrice = basePrice - (basePrice * discountPercent) / 100;
      let toppingTotal = 0;
      const validatedToppings: Array<{ id: string; name: string; price: number }> = [];

      for (const topping of food.toppings) {
        toppingTotal += topping.unitPrice * quantity;
        validatedToppings.push({
          id: topping.toppingId,
          name: topping.name,
          price: topping.unitPrice,
        });
      }

      const itemTotal = discountedPrice * quantity + toppingTotal;
      calculatedTotal += itemTotal;
      foodDetails.push({
        foodId: food.foodId,
        foodName: food.name,
        quantity,
        selectedToppings: validatedToppings,
        toppingTotal,
        discountPercent,
        discountedPrice,
        itemTotal,
      });
    }

    return { calculatedTotal, foodDetails };
  }

  private async createOrderDetails(
    order: Order,
    foodDetails: Awaited<ReturnType<typeof this.validateAndCalculateOrderDetails>>['foodDetails'],
    queryRunner: QueryRunner,
  ) {
    for (const detail of foodDetails) {
      const orderDetail = new OrderDetail();
      orderDetail.order = order;
      orderDetail.food = { id: detail.foodId } as OrderDetail['food'];
      orderDetail.quantity = detail.quantity;
      orderDetail.price = String(detail.discountedPrice);
      const snapshot = createOrderItemSnapshot({
        foodId: detail.foodId,
        foodName: detail.foodName,
        unitPrice: detail.discountedPrice,
        quantity: detail.quantity,
        toppings: detail.selectedToppings || [],
      });
      orderDetail.foodNameSnapshot = snapshot.foodName;
      orderDetail.unitPriceSnapshot = snapshot.unitPrice;
      orderDetail.selectedToppings = [...snapshot.toppings];
      orderDetail.toppingTotal = detail.toppingTotal;
      await queryRunner.manager.save(OrderDetail, orderDetail);
    }
  }

  private async getPricingItems(
    items: readonly { foodId: string; quantity: number; toppingIds: readonly string[] }[],
    restaurantId: string,
  ): Promise<OrderPricingItemSnapshot[]> {
    const menuItems = await this.getOrderableItems(items, restaurantId);
    return menuItems.map((item, index) => ({
      foodId: item.foodId,
      unitPrice: item.unitPrice,
      discountPercent: item.discountPercent,
      quantity: Number(items[index].quantity),
      toppings: item.toppings.map((topping) => ({
        id: topping.toppingId,
        unitPrice: topping.unitPrice,
      })),
    }));
  }

  private async getOrderableItems(
    items: readonly { foodId: string; quantity: number; toppingIds: readonly string[] }[],
    restaurantId: string,
  ): Promise<OrderableItemSnapshot[]> {
    const menuItems = await this.menuReader.getOrderableItems({
      items: items.map((item) => ({
        foodId: item.foodId,
        toppingIds: [...item.toppingIds],
      })),
    });

    if (menuItems.length !== items.length) {
      throw new BadRequestException('Some requested food items could not be resolved');
    }

    for (const [index, item] of menuItems.entries()) {
      const requested = items[index];
      if (!requested || item.foodId !== requested.foodId) {
        throw new BadRequestException('Menu response does not match the requested items');
      }
      if (!Number.isFinite(Number(requested.quantity)) || Number(requested.quantity) <= 0) {
        throw new BadRequestException(`Invalid quantity for food ID ${requested.foodId}`);
      }
      if (item.restaurantId !== restaurantId) {
        throw new BadRequestException(`Food with ID ${item.foodId} is not from this restaurant`);
      }
      if (!item.isAvailable || item.status !== 'available') {
        throw new BadRequestException(`Food with ID ${item.foodId} is not orderable`);
      }
      if (item.toppings.some((topping) => !topping.isAvailable)) {
        throw new BadRequestException(
          `A selected topping for food ID ${item.foodId} is not orderable`,
        );
      }
    }

    return menuItems;
  }

  /**
   * Get orders placed by a specific user/customer
   */
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

  /**
   * Get minimal order history for quick reordering
   */
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
      orderDetails: (order.orderDetails || []).map((detail) => ({
        foodId: detail.food?.id,
        foodName: detail.foodNameSnapshot ?? detail.food?.name,
        quantity: detail.quantity,
        price: detail.unitPriceSnapshot ?? detail.price,
      })),
    }));
  }

  /**
   * Get detailed order history for customer
   */
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
      orderDetails: (order.orderDetails || []).map((detail) => ({
        foodName: detail.foodNameSnapshot ?? detail.food?.name,
        quantity: detail.quantity,
        price: detail.unitPriceSnapshot ?? detail.price,
        totalPrice: (
          Number(detail.unitPriceSnapshot ?? detail.price ?? 0) * detail.quantity
        ).toFixed(2),
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

  /**
   * Delete an order and its associated details
   */
  async deleteOrder(id: string) {
    const order = await this.orderCoreService.getOrderById(id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (order.orderDetails && order.orderDetails.length > 0) {
        await queryRunner.manager.delete(OrderDetail, {
          order: { id: order.id },
        });
      }

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

  /**
   * Process payment for an order
   */
  async processPayment(orderId: string, paymentData: PaymentDto) {
    const order = await this.orderCoreService.getOrderById(orderId);

    if (order.status !== 'pending') {
      throw new BadRequestException('Cannot process payment for an order that is not pending');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      if (!paymentData.method) {
        throw new BadRequestException('Payment method is required');
      }

      switch (paymentData.method) {
        case 'credit_card':
          if (!paymentData.cardNumber || !paymentData.expiryDate || !paymentData.cvv) {
            throw new BadRequestException('Credit card information is incomplete');
          }
          break;
        case 'paypal':
          if (!paymentData.paypalToken) {
            throw new BadRequestException('PayPal token is required');
          }
          break;
        case 'cash':
          break;
        default:
          throw new BadRequestException('Unsupported payment method');
      }

      try {
        order.status = this.orderStateMachine.startPayment(order.status);
      } catch (error) {
        if (
          error instanceof InvalidOrderStatusError ||
          error instanceof InvalidOrderTransitionError
        ) {
          throw new BadRequestException(error.message);
        }
        throw error;
      }

      order.paymentMethod = paymentData.method;
      order.paymentDate = new Date().toISOString();

      await this.orderRepository.save(order);
      await queryRunner.commitTransaction();

      return {
        success: true,
        message: 'Payment processed successfully',
        order: await this.orderCoreService.getOrderById(orderId),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Orders depend on the route contract, not the Mapbox adapter. A straight-line
   * estimate preserves the previous availability behaviour if the provider is
   * unavailable and keeps pricing resilient to a routing outage.
   */
  private async calculateDeliveryRoute(
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
  ): Promise<{ distance: number; duration: number }> {
    try {
      const route = await this.routePort.getDistanceAndDuration([fromLng, fromLat], [toLng, toLat]);
      if (route) {
        return {
          distance: route.distanceKm,
          duration: Math.round(route.durationMin * 60),
        };
      }
    } catch (error: unknown) {
      this.logger.warn(
        `Route provider unavailable; using distance estimate: ${errorMessage(error)}`,
      );
    }

    const distance = haversineDistance(fromLat, fromLng, toLat, toLng);
    return { distance, duration: Math.round(distance * 180) };
  }
}
