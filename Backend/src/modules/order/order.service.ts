import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { InProcessEventBus } from 'src/common/events/in-process-event-bus.service';
import {
  NOTIFICATION_REQUESTED_EVENT,
  NotificationRequestedEvent,
} from 'src/common/events/notification-requested.event';
import { Address } from 'src/entities/address.entity';
import { Checkout, CheckoutStatus } from 'src/entities/checkout.entity';
import { Food } from 'src/entities/food.entity';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { Promotion, PromotionType } from 'src/entities/promotion.entity';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import { Topping } from 'src/entities/topping.entity';
import { User } from 'src/entities/user.entity';
import {
  OrderPricingService,
  type OrderPricingItemSnapshot,
} from 'src/features/orders/pricing/order-pricing.service';
import {
  InvalidOrderStatusError,
  InvalidOrderTransitionError,
  OrderStateMachine,
} from 'src/features/orders/state-machine/order-status';
import { MapboxService } from 'src/infra/maps/mapbox.service';
import { PendingAssignmentService } from 'src/infra/queue/pending-assignment.service';
import { pubSub } from 'src/pubsub';
import { SystemConstraintsService } from 'src/services/system-constraints.service';
import { DataSource, LessThan, Repository } from 'typeorm';
import { PromotionService } from '../promotion/promotion.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { PaymentDto } from './dto/payment.dto';
import { OrderCommandService } from './order-command.service';
import { OrderCreateService } from './order-create.service';
import { OrderQueryService } from './order-query.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly orderStateMachine = new OrderStateMachine();
  private readonly pricingService = new OrderPricingService();

  constructor(
    @InjectRepository(Order)
    private orderRepository: Repository<Order>,
    @InjectRepository(OrderDetail)
    private orderDetailRepository: Repository<OrderDetail>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Restaurant)
    private restaurantRepository: Repository<Restaurant>,
    @InjectRepository(Food)
    private foodRepository: Repository<Food>,
    @InjectRepository(Address)
    private addressRepository: Repository<Address>,
    @InjectRepository(Promotion)
    private promotionRepository: Repository<Promotion>,
    private dataSource: DataSource,
    @InjectRepository(Checkout)
    private checkoutRepository: Repository<Checkout>,
    private promotionService: PromotionService,
    private pendingAssignmentService: PendingAssignmentService,
    private readonly eventBus: InProcessEventBus,
    @InjectRepository(Topping)
    private toppingRepository: Repository<Topping>,
    private readonly systemConstraintsService: SystemConstraintsService, // Inject SystemConstraintsService
    private readonly mapboxService: MapboxService, // Add this
    private readonly orderQueryService: OrderQueryService,
    private readonly orderCommandService: OrderCommandService,
    private readonly orderCreateService: OrderCreateService,
  ) {}

  private async validateAndCalculateOrderDetails(
    orderDetails: {
      foodId: string;
      quantity: string;
      price?: string; // optional từ client, không dùng để tính
      selectedToppings?: Array<{ id: string; name: string; price: number }>;
      discountPercent?: number; // thêm nếu client gửi
    }[],
    restaurantId: string,
  ): Promise<{
    calculatedTotal: number;
    foodDetails: {
      food: Food;
      quantity: number;
      selectedToppings?: { id: string; name: string; price: number }[];
      toppingTotal: number;
      discountPercent: number;
      discountedPrice: number;
      itemTotal: number;
    }[];
  }> {
    let calculatedTotal = 0;
    const foodDetails: Array<{
      food: Food;
      quantity: number;
      selectedToppings?: { id: string; name: string; price: number }[];
      toppingTotal: number;
      discountPercent: number;
      discountedPrice: number;
      itemTotal: number;
    }> = [];

    for (const detail of orderDetails) {
      console.log('>>>>> Received selectedToppings:', detail.selectedToppings);
      const food = await this.foodRepository.findOne({
        where: { id: detail.foodId },
        relations: ['toppings', 'restaurant'],
      });

      if (!food) {
        throw new NotFoundException(`Food with ID ${detail.foodId} not found`);
      }
      if (food.status !== 'available') {
        throw new BadRequestException(`Food with ID ${detail.foodId} is not available`);
      }
      if (food.restaurant?.id !== restaurantId) {
        throw new BadRequestException(`Food with ID ${detail.foodId} is not from this restaurant`);
      }

      const quantity = Number(detail.quantity);
      if (isNaN(quantity) || quantity <= 0) {
        throw new BadRequestException(`Invalid quantity for food ID ${detail.foodId}`);
      }

      // Discount xử lý
      const basePrice = Number(food.price);
      const discountPercent = Number(food.discountPercent) || 0;
      const discountedPrice = basePrice - (basePrice * discountPercent) / 100;

      // Xử lý topping
      let toppingTotal = 0;
      const validatedToppings: Array<{ id: string; name: string; price: number }> = [];

      if (detail.selectedToppings && detail.selectedToppings.length > 0) {
        for (const selectedTopping of detail.selectedToppings) {
          const topping = await this.toppingRepository.findOne({
            where: {
              id: selectedTopping.id,
              food: { id: detail.foodId },
              isAvailable: true,
            },
          });

          if (!topping) {
            throw new BadRequestException(
              `Topping ${selectedTopping.name} is not available for this food`,
            );
          }

          toppingTotal += Number(topping.price) * quantity;
          validatedToppings.push({
            id: topping.id,
            name: topping.name,
            price: Number(topping.price),
          });
        }
      }
      console.log(`Topping total for food ${food.name}: ${toppingTotal}`);
      const itemTotal = discountedPrice * quantity + toppingTotal;
      calculatedTotal += itemTotal;

      foodDetails.push({
        food,
        quantity,
        selectedToppings: validatedToppings,
        toppingTotal,
        discountPercent,
        discountedPrice,
        itemTotal,
      });
    }
    console.log(
      `topping total: ${foodDetails.map((f) => f.toppingTotal).reduce((a, b) => a + b, 0)}`,
    );
    console.log(`Calculated total for order: ${calculatedTotal}`);
    return { calculatedTotal, foodDetails };
  }

  private async createOrderDetails(
    order: Order,
    foodDetails: {
      food: Food;
      quantity: number;
      selectedToppings?: Array<{ id: string; name: string; price: number }>;
      toppingTotal: number;
      discountPercent: number;
      discountedPrice: number;
      itemTotal: number;
    }[],
    queryRunner: any,
  ): Promise<void> {
    for (const detail of foodDetails) {
      const orderDetail = new OrderDetail();
      orderDetail.order = order;
      orderDetail.food = detail.food;
      orderDetail.quantity = detail.quantity;
      orderDetail.price = String(detail.discountedPrice); // ✅ giá sau giảm
      orderDetail.selectedToppings = detail.selectedToppings || [];
      orderDetail.toppingTotal = detail.toppingTotal;

      await queryRunner.manager.save(OrderDetail, orderDetail);
    }
  }

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
      throw new BadRequestException(`Invalid coordinates: lat=${lat}, lng=${lng}`);
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
    this.logger.log(`📍 Coordinates: ${savedAddress.latitude}, ${savedAddress.longitude}`);

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
      this.logger.error(`❌ Failed to delete temporary address ${addressId}: ${error.message}`);
    }
  }

  async createOrder(data: CreateOrderDto) {
    return this.orderCreateService.createOrder(data);
  }

  private async legacyCreateOrder(data: CreateOrderDto) {
    this.logger.log(`🚀 Starting enhanced order creation for user ${data.userId}`);
    this.logger.log(`📍 Using address ID: ${data.addressId}`);

    if (!data.orderDetails || data.orderDetails.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const constraints = await this.systemConstraintsService.getConstraints();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const user = await queryRunner.manager.findOne(User, { where: { id: data.userId } });
      if (!user) throw new NotFoundException('User not found');

      const restaurant = await queryRunner.manager.findOne(Restaurant, {
        where: { id: data.restaurantId },
        relations: ['address'],
      });
      if (!restaurant || !restaurant.address) {
        throw new NotFoundException('Restaurant or its address not found');
      }
      if (restaurant.status !== RestaurantStatus.APPROVED) {
        throw new BadRequestException('Restaurant is not active');
      }

      const address = await queryRunner.manager.findOne(Address, {
        where: { id: data.addressId, user: { id: data.userId } },
      });
      if (!address) {
        throw new NotFoundException('Delivery address not found');
      }

      // 🔍 DEBUG: Log the coordinates with null checking
      this.logger.log(`🔍 === MAPBOX ROUTE CALCULATION ===`);
      this.logger.log(`📍 User Address: ${address.street}, ${address.ward}, ${address.district}`);
      this.logger.log(`   - Coordinates: ${address.latitude}, ${address.longitude}`);
      this.logger.log(`   - Is Temporary: ${address.isTemporary || false}`);
      this.logger.log(`🏪 Restaurant: ${restaurant.name}`);
      this.logger.log(
        `   - Address: ${restaurant.address.street}, ${restaurant.address.ward}, ${restaurant.address.district}`,
      );
      this.logger.log(
        `   - Coordinates: ${restaurant.address.latitude}, ${restaurant.address.longitude}`,
      );

      // 🚨 CRITICAL FIX: Check for null coordinates BEFORE calling Mapbox
      if (address.latitude === null || address.longitude === null) {
        this.logger.error(`❌ Address coordinates are null!`);
        this.logger.error(`   - Address ID: ${address.id}`);
        this.logger.error(`   - User ID: ${data.userId}`);
        this.logger.error(`   - Street: ${address.street}`);
        throw new BadRequestException(
          'Delivery address coordinates are missing. Please select a valid address or provide coordinates.',
        );
      }

      if (restaurant.address.latitude === null || restaurant.address.longitude === null) {
        this.logger.error(`❌ Restaurant coordinates are null!`);
        this.logger.error(`   - Restaurant ID: ${restaurant.id}`);
        this.logger.error(`   - Restaurant: ${restaurant.name}`);
        throw new BadRequestException(
          'Restaurant coordinates are missing. Please contact support.',
        );
      }

      // Convert coordinates to numbers
      const userLat = Number(address.latitude);
      const userLng = Number(address.longitude);
      const restaurantLat = Number(restaurant.address.latitude);
      const restaurantLng = Number(restaurant.address.longitude);

      // Validate coordinates are within reasonable ranges
      if (Math.abs(userLat) > 90 || Math.abs(userLng) > 180) {
        this.logger.error(`❌ Invalid user coordinates: lat=${userLat}, lng=${userLng}`);
        throw new BadRequestException(`Invalid user coordinates: lat=${userLat}, lng=${userLng}`);
      }
      if (Math.abs(restaurantLat) > 90 || Math.abs(restaurantLng) > 180) {
        this.logger.error(
          `❌ Invalid restaurant coordinates: lat=${restaurantLat}, lng=${restaurantLng}`,
        );
        throw new BadRequestException(
          `Invalid restaurant coordinates: lat=${restaurantLat}, lng=${restaurantLng}`,
        );
      }

      this.logger.log(`✅ Coordinates validated successfully`);
      this.logger.log(`   - User: ${userLat}, ${userLng}`);
      this.logger.log(`   - Restaurant: ${restaurantLat}, ${restaurantLng}`);

      // 🗺️ Use Mapbox to calculate ACTUAL route distance
      const routeResult = await this.mapboxService.calculateBikeRoute(
        restaurantLat,
        restaurantLng, // From restaurant
        userLat,
        userLng, // To user
      );

      const deliveryDistance = routeResult.distance;
      const mapboxEstimatedDeliveryTime = Math.round(routeResult.duration / 60); // Convert to minutes

      this.logger.log(`📏 Mapbox route calculated:`);
      this.logger.log(`   - Distance: ${deliveryDistance}km`);
      this.logger.log(`   - Duration: ${mapboxEstimatedDeliveryTime} minutes`);
      this.logger.log(`   - Max allowed: ${constraints.max_delivery_distance}km`);

      // Validate distance against constraints
      if (!(await this.systemConstraintsService.isDistanceWithinLimits(deliveryDistance))) {
        this.logger.error(
          `❌ Distance validation failed: ${deliveryDistance}km > ${constraints.max_delivery_distance}km`,
        );
        throw new BadRequestException(
          `Delivery distance of ${deliveryDistance}km exceeds the maximum of ${constraints.max_delivery_distance}km.`,
        );
      }

      // Continue with the rest of the order creation using Mapbox-calculated values
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
        estimatedDeliveryTime: mapboxEstimatedDeliveryTime, // Pass the Mapbox calculated time
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
        const now = new Date();
        validatedDeliveryTime = new Date(now.getTime() + data.requestedDeliveryTime * 60000);
        estimatedDeliveryTime = data.requestedDeliveryTime;
      }

      const order = new Order();
      order.user = user;
      order.restaurant = restaurant;
      order.total = orderCalculation.total;
      order.note = data.note || '';
      order.address = address;
      order.date = new Date().toISOString();
      order.deliveryDistance = deliveryDistance; // Use Mapbox distance
      order.shippingFee = orderCalculation.shippingFee;
      order.estimatedDeliveryTime = estimatedDeliveryTime; // Use Mapbox time
      order.deliveryType = data.deliveryType || 'asap';
      order.requestedDeliveryTime = validatedDeliveryTime?.toISOString();
      order.paymentMethod = data.paymentMethod || 'cod';
      order.status =
        data.paymentMethod && data.paymentMethod !== 'cod' ? 'processing_payment' : 'pending';

      if (data.promotionCode && orderCalculation.appliedPromotion) {
        const promotion = await queryRunner.manager.findOne(Promotion, {
          where: { code: data.promotionCode },
        });
        if (!promotion) {
          throw new NotFoundException(`Promotion with code ${data.promotionCode} not found`);
        }
        order.promotionCode = promotion;
      }

      const savedOrder = await queryRunner.manager.save(Order, order);
      await this.createOrderDetails(savedOrder, foodDetails, queryRunner);

      if (order.promotionCode) {
        await this.promotionService.usePromotion(
          order.promotionCode.code,
          orderCalculation.subtotal,
          queryRunner.manager,
        );
      }

      await queryRunner.commitTransaction();
      if (order.promotionCode) {
        try {
          await this.promotionService.clearPromotionCache();
        } catch (cacheError) {
          this.logger.warn(
            `Order committed but promotion cache invalidation failed: ${(cacheError as Error).message}`,
          );
        }
      }
      this.logger.log(`✅ Enhanced order transaction committed for order ID: ${savedOrder.id}`);
      console.log(`Order created successfully with ID: ${savedOrder.id}`);
      return await this.getOrderById(savedOrder.id);
    } catch (error) {
      this.logger.error(`❌ Enhanced order creation failed: ${error.message}`, error.stack);
      if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async getAllOrders() {
    return this.orderQueryService.getAllOrders();
  }

  async getOrderById(id: string, includeReviewInfo: boolean = false): Promise<Order> {
    return this.orderQueryService.getOrderById(id, includeReviewInfo);
  }

  // Add a new method specifically for getting order with review info
  async getOrderByIdWithReviews(id: string) {
    return this.getOrderById(id, true);
  }

  async getOrdersByUser(userId: string, page: number = 1, pageSize: number = 10, status?: string) {
    return this.orderQueryService.getOrdersByUser(userId, page, pageSize, status);
  }
  async getOrdersByRestaurant(
    restaurantId: string,
    page: number = 1,
    pageSize: number = 10,
    status?: string,
  ) {
    return this.orderQueryService.getOrdersByRestaurant(restaurantId, page, pageSize, status);
  }
  async updateOrderStatus(id: string, status: string) {
    return this.orderCommandService.updateStatus(id, status);
  }

  async confirmOrder(orderId: string, restaurantOwnerId: string): Promise<Order> {
    return this.orderCommandService.confirm(orderId, restaurantOwnerId);
  }

  // private async calculateOrderWithConstraints(data: {
  //     addressId: string,
  //     restaurantId: string,
  //     items: {
  //       foodId: string;
  //       quantity: number;
  //       discountPercent?: number;
  //       toppings?: { id: string; price: number }[];
  //     }[],
  //     promotionCode?: string,
  //     deliveryDistance: number,
  //     estimatedDeliveryTime?: number // Add this parameter
  //   }) {
  //     const { deliveryDistance } = data;
  //     const shippingFee = await this.systemConstraintsService.calculateShippingFee(deliveryDistance);
  //     const maxDeliveryTime = await this.systemConstraintsService.getMaxDeliveryTime();

  //     // Use provided estimatedDeliveryTime or calculate fallback
  //     const estimatedDeliveryTime = data.estimatedDeliveryTime ||
  //         Math.min(maxDeliveryTime, Math.ceil(deliveryDistance * 2) + 20);

  //     const shipperCommissionRate = 0.8;
  //     const shipperEarnings = Math.round(shippingFee * shipperCommissionRate);
  //     const platformFee = shippingFee - shipperEarnings;

  //     let foodTotal = 0;
  //     for (const item of data.items) {
  //         const food = await this.foodRepository.findOne({ where: { id: item.foodId } });
  //         if (!food) continue;

  //         const discountPercent = item.discountPercent || food.discountPercent || 0;
  //         const discountedPrice = Number(food.price) - (Number(food.price) * discountPercent) / 100;

  //         const toppingTotal = (item.toppings || []).reduce((sum, t) => sum + Number(t.price), 0);

  //         foodTotal += (discountedPrice + toppingTotal) * item.quantity;
  //       }

  //     let appliedPromotion: Promotion | null = null;
  //     let promotionDiscount = 0;
  //     let promotionError: string | null = null;
  //     const subtotal = foodTotal + shippingFee;

  //     if (data.promotionCode) {
  //       const validation = await this.promotionService.validatePromotion(data.promotionCode, subtotal);
  //       if (validation.valid && validation.promotion) {
  //         appliedPromotion = validation.promotion;
  //         promotionDiscount = validation.calculatedDiscount || 0;
  //       } else {
  //         promotionError = validation.reason || 'Invalid promotion code.';
  //       }
  //     }

  //     const total = Math.max(0, subtotal - promotionDiscount);
  //     console.log(`>>>>>>>>>>Final Total: ${total}`);
  //     return {
  //       foodTotal,
  //       shippingFee,
  //       shipperEarnings,
  //       shipperCommissionRate,
  //       platformFee,
  //       distance: Number(deliveryDistance.toFixed(2)),
  //       subtotal,
  //       promotionDiscount,
  //       total,
  //       estimatedDeliveryTime,
  //       appliedPromotion,
  //       promotionError
  //     };
  //   }

  // This method is now a wrapper for the new constrained calculation
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
    this.logger.log(`🧮 === CALCULATE ORDER WITH MAPBOX ===`);

    const address = await this.addressRepository.findOne({ where: { id: data.addressId } });
    const restaurant = await this.restaurantRepository.findOne({
      where: { id: data.restaurantId },
      relations: ['address'],
    });

    if (!address || !restaurant || !restaurant.address) {
      throw new Error('Invalid address or restaurant');
    }
    if (restaurant.status !== RestaurantStatus.APPROVED) {
      throw new BadRequestException('Restaurant is not active');
    }

    const userLat = Number(address.latitude);
    const userLng = Number(address.longitude);
    const restaurantLat = Number(restaurant.address.latitude);
    const restaurantLng = Number(restaurant.address.longitude);

    // 🗺️ Use Mapbox for actual route calculation
    const routeResult = await this.mapboxService.calculateBikeRoute(
      restaurantLat,
      restaurantLng,
      userLat,
      userLng,
    );

    const deliveryDistance = routeResult.distance;
    const estimatedDeliveryTime = Math.round(routeResult.duration / 60);

    this.logger.log(`📏 Mapbox calculation:`);
    this.logger.log(`   - Distance: ${deliveryDistance}km`);
    this.logger.log(`   - Duration: ${estimatedDeliveryTime} minutes`);

    return this.calculateOrderWithConstraints({
      ...data,
      deliveryDistance,
      estimatedDeliveryTime,
    });
  }

  // Update calculateOrderWithCustomAddress to use Mapbox
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
    // Fetch restaurant with address
    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId },
      relations: ['address'],
    });

    if (!restaurant || !restaurant.address) {
      throw new Error('Invalid restaurant');
    }
    if (restaurant.status !== RestaurantStatus.APPROVED) {
      throw new BadRequestException('Restaurant is not active');
    }

    // 🗺️ Use Mapbox for actual route calculation
    const routeResult = await this.mapboxService.calculateBikeRoute(
      Number(restaurant.address.latitude),
      Number(restaurant.address.longitude),
      Number(address.latitude),
      Number(address.longitude),
    );

    const distance = routeResult.distance;
    const estimatedDeliveryTime = Math.round(routeResult.duration / 60);

    this.logger.log(`📏 Custom address route: ${distance}km, ${estimatedDeliveryTime} minutes`);

    // Use system constraints to calculate shipping fee
    const shippingFee = await this.systemConstraintsService.calculateShippingFee(distance);

    // ... rest of the calculation logic using the Mapbox values

    const pricingItems: OrderPricingItemSnapshot[] = [];
    for (const item of items) {
      const food = await this.foodRepository.findOne({
        where: { id: item.foodId },
        relations: ['restaurant'],
      });
      if (!food) throw new NotFoundException(`Food with ID ${item.foodId} not found`);
      if (food.status !== 'available' || food.restaurant?.id !== restaurantId) {
        throw new BadRequestException(`Food with ID ${item.foodId} is not orderable`);
      }

      const discountPercent = Number(food.discountPercent) || 0;
      const toppings: { id: string; unitPrice: number }[] = [];
      for (const selectedTopping of item.toppings || []) {
        const topping = await this.toppingRepository.findOne({
          where: { id: selectedTopping.id, food: { id: item.foodId }, isAvailable: true },
        });
        if (!topping) {
          throw new BadRequestException(`Topping ${selectedTopping.id} is not orderable`);
        }
        toppings.push({ id: topping.id, unitPrice: Number(topping.price) });
      }

      pricingItems.push({
        foodId: item.foodId,
        unitPrice: Number(food.price),
        discountPercent,
        quantity: item.quantity,
        toppings,
      });
    }

    let promotionDiscount = 0;
    let appliedPromotion: Promotion | null = null;
    let promotionError: string | null = null;

    // Apply promotion logic...
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
          // Calculate discount based on promotion type
          if (appliedPromotion.type === PromotionType.FOOD_DISCOUNT) {
            promotionDiscount = this.promotionService.calculateDiscount(
              appliedPromotion,
              this.pricingService.calculate({
                items: pricingItems,
                shippingFee: 0,
                promotionDiscount: 0,
              }).foodTotal,
            );
          } else if (appliedPromotion.type === PromotionType.SHIPPING_DISCOUNT) {
            promotionDiscount = Math.min(
              this.promotionService.calculateDiscount(appliedPromotion, shippingFee),
              shippingFee,
            );
          }
        } else {
          promotionError = validation.reason || 'Invalid promotion code';
        }
      } catch (error) {
        promotionError = 'Failed to validate promotion code';
        this.logger.error(`Promotion validation error: ${error.message}`);
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

  // Update calculateOrderWithConstraints to accept estimatedDeliveryTime
  private async calculateOrderWithConstraints(data: {
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
    estimatedDeliveryTime?: number; // Add this parameter
  }) {
    const { deliveryDistance } = data;
    const shippingFee = await this.systemConstraintsService.calculateShippingFee(deliveryDistance);
    const maxDeliveryTime = await this.systemConstraintsService.getMaxDeliveryTime();

    // Use provided estimatedDeliveryTime or calculate fallback
    const estimatedDeliveryTime =
      data.estimatedDeliveryTime || Math.min(maxDeliveryTime, Math.ceil(deliveryDistance * 2) + 20);

    const shipperCommissionRate = 0.8;
    const shipperEarnings = Math.round(shippingFee * shipperCommissionRate);
    const platformFee = shippingFee - shipperEarnings;

    const pricingItems: OrderPricingItemSnapshot[] = [];
    for (const item of data.items) {
      const food = await this.foodRepository.findOne({
        where: { id: item.foodId },
        relations: ['restaurant'],
      });
      if (!food) throw new NotFoundException(`Food with ID ${item.foodId} not found`);
      if (food.status !== 'available' || food.restaurant?.id !== data.restaurantId) {
        throw new BadRequestException(`Food with ID ${item.foodId} is not orderable`);
      }

      const discountPercent = Number(food.discountPercent) || 0;
      const toppings: { id: string; unitPrice: number }[] = [];
      for (const selectedTopping of item.toppings || []) {
        const topping = await this.toppingRepository.findOne({
          where: { id: selectedTopping.id, food: { id: item.foodId }, isAvailable: true },
        });
        if (!topping) {
          throw new BadRequestException(`Topping ${selectedTopping.id} is not orderable`);
        }
        toppings.push({ id: topping.id, unitPrice: Number(topping.price) });
      }

      pricingItems.push({
        foodId: item.foodId,
        unitPrice: Number(food.price),
        discountPercent,
        quantity: item.quantity,
        toppings,
      });
    }

    let appliedPromotion: Promotion | null = null;
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
      throw new BadRequestException('Cannot process payment for an order that is not pending');
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

      const paymentSuccess = true;
      const paymentMessage = 'Payment processed successfully';

      // Simulate payment processing based on method
      switch (paymentData.method) {
        case 'credit_card':
          // Validate credit card info
          if (!paymentData.cardNumber || !paymentData.expiryDate || !paymentData.cvv) {
            throw new BadRequestException('Credit card information is incomplete');
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
    return this.orderQueryService.getOrderDetails(orderId);
  }
  /**
   * Confirm payment for an order
   * @param orderId The ID of the order to confirm payment for
   * @returns The updated order
   */
  async confirmPayment(orderId: string): Promise<Order> {
    return this.orderCommandService.markPaid(orderId);
  }

  // Runs every 10 minutes
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCancelStuckOrders() {
    const timeoutMinutes = 15;
    const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    // Find stuck orders
    const stuckOrders = await this.orderRepository.find({
      where: {
        status: 'processing_payment',
        createdAt: LessThan(timeoutDate),
      },
    });

    if (stuckOrders.length) {
      this.logger.log(`Auto-canceling ${stuckOrders.length} stuck orders...`);
    }

    for (const order of stuckOrders) {
      order.status = 'canceled';
      await this.orderRepository.save(order);

      // Optionally, update related checkout status
      const checkout = await this.checkoutRepository.findOne({ where: { orderId: order.id } });
      if (
        checkout &&
        checkout.status !== CheckoutStatus.COMPLETED &&
        checkout.status !== CheckoutStatus.CANCELLED
      ) {
        checkout.status = CheckoutStatus.CANCELLED;
        await this.checkoutRepository.save(checkout);
      }

      this.logger.log(`Order ${order.id} auto-canceled due to payment timeout.`);
    }
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
    return this.orderQueryService.getMinimalOrderHistoryForQuickReorder(userId, limit);
  }

  async getOrderHistory(userId: string, page: number = 1, pageSize: number = 10) {
    return this.orderQueryService.getOrderHistory(userId, page, pageSize);
  }

  // Add new cron job to auto-cancel orders without shippers
  @Cron(CronExpression.EVERY_10_MINUTES)
  async autoCancelUnassignedOrders() {
    const timeoutMinutes = 30; // Cancel orders after 30 minutes without shipper
    const timeoutDate = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    this.logger.log(`🔍 Checking for pending assignments older than ${timeoutMinutes} minutes...`);

    // Find pending assignments that are too old
    const expiredAssignments =
      await this.pendingAssignmentService.getExpiredAssignments(timeoutDate);

    if (expiredAssignments.length > 0) {
      this.logger.log(`🚫 Found ${expiredAssignments.length} expired assignments to cancel`);
    }

    for (const assignment of expiredAssignments) {
      try {
        const order = await this.orderRepository.findOne({
          where: { id: assignment.order.id },
          relations: ['shippingDetail', 'restaurant', 'user'],
        });

        if (!order) {
          await this.pendingAssignmentService.removePendingAssignmentById(assignment.id);
          continue;
        }

        // Double-check order is still confirmed and unassigned
        if (order.status !== 'confirmed') {
          this.logger.log(
            `⏭️ Skipping order ${order.id} - status already changed to ${order.status}`,
          );
          continue;
        }

        // Check if order already has a shipper
        if (order.shippingDetail) {
          this.logger.log(`⏭️ Skipping order ${order.id} - already assigned to shipper`);
          // Clean up the pending assignment
          await this.pendingAssignmentService.removePendingAssignment(order.id);
          continue;
        }

        // Update order status to canceled
        order.status = 'canceled';
        await this.orderRepository.save(order);

        // Remove the pending assignment
        await this.pendingAssignmentService.removePendingAssignmentById(assignment.id);

        // Publish event for order cancellation
        await pubSub.publish('orderStatusUpdated', {
          orderStatusUpdated: order,
        });

        // Calculate how long the assignment was pending
        const pendingDuration = Math.round(
          (Date.now() - assignment.createdAt.getTime()) / (1000 * 60),
        );

        this.logger.log(
          `❌ Auto-canceled order ${order.id} (${order.restaurant?.name}) - pending for ${pendingDuration} minutes without shipper`,
        );

        // Optional: Send notifications
        await this.notifyOrderCancellation(order, 'No delivery driver available in your area');
      } catch (error) {
        this.logger.error(`❌ Failed to auto-cancel order ${assignment.order.id}:`, error);
      }
    }

    if (expiredAssignments.length > 0) {
      this.logger.log(
        `🎯 Auto-cancellation completed: ${expiredAssignments.length} orders canceled`,
      );
    }
  }

  /**
   * Send notifications for order cancellation
   */
  private async notifyOrderCancellation(
    order: Order,
    reason: string = 'No shipper available',
  ): Promise<void> {
    try {
      await this.eventBus.publish<NotificationRequestedEvent>(NOTIFICATION_REQUESTED_EVENT, {
        recipientUserId: order.user?.id ?? '',
        description: 'Đơn hàng đã bị hủy',
        content: `Đơn hàng #${order.id} đã bị hủy: ${reason}`,
        type: 'order',
      });

      this.logger.log(`✅ Cancellation notification published for order ${order.id}`);
    } catch (error) {
      this.logger.error(
        `❌ Failed to publish cancellation notification for order ${order.id}:`,
        error,
      );
    }
  }
  // Add this method to clean up old temporary addresses
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupTemporaryAddresses() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    try {
      const result = await this.addressRepository.delete({
        isTemporary: true,
        createdAt: LessThan(oneDayAgo),
      });

      if (result.affected && result.affected > 0) {
        this.logger.log(`🗑️ Cleaned up ${result.affected} temporary addresses older than 24 hours`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to cleanup temporary addresses: ${error.message}`);
    }
  }
}
