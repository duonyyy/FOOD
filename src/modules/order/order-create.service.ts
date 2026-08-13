import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Food } from 'src/entities/food.entity';
import { Order } from 'src/entities/order.entity';
import { OrderDetail } from 'src/entities/orderDetail.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import { Topping } from 'src/entities/topping.entity';
import { User } from 'src/entities/user.entity';
import {
  OrderPricingService,
  type OrderPricingItemSnapshot,
} from 'src/features/orders/pricing/order-pricing.service';
import { createOrderItemSnapshot } from 'src/features/orders/snapshots/order-item-snapshot';
import { MapboxService } from 'src/infra/maps/mapbox.service';
import { SystemConstraintsService } from 'src/services/system-constraints.service';
import { DataSource, Repository } from 'typeorm';
import { PromotionService } from '../promotion/promotion.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryService } from './order-query.service';

@Injectable()
export class OrderCreateService {
  private readonly logger = new Logger(OrderCreateService.name);
  private readonly pricingService = new OrderPricingService();

  constructor(
    @InjectRepository(Food)
    private readonly foodRepository: Repository<Food>,
    @InjectRepository(Topping)
    private readonly toppingRepository: Repository<Topping>,
    private readonly dataSource: DataSource,
    private readonly promotionService: PromotionService,
    private readonly systemConstraintsService: SystemConstraintsService,
    private readonly mapboxService: MapboxService,
    private readonly orderQueryService: OrderQueryService,
  ) {}

  async createOrder(data: CreateOrderDto) {
    this.logger.log(`Starting enhanced order creation for user ${data.userId}`);

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
      if (!address) throw new NotFoundException('Delivery address not found');

      if (address.latitude === null || address.longitude === null) {
        throw new BadRequestException(
          'Delivery address coordinates are missing. Please select a valid address or provide coordinates.',
        );
      }
      if (restaurant.address.latitude === null || restaurant.address.longitude === null) {
        throw new BadRequestException(
          'Restaurant coordinates are missing. Please contact support.',
        );
      }

      const userLat = Number(address.latitude);
      const userLng = Number(address.longitude);
      const restaurantLat = Number(restaurant.address.latitude);
      const restaurantLng = Number(restaurant.address.longitude);
      if (Math.abs(userLat) > 90 || Math.abs(userLng) > 180) {
        throw new BadRequestException(`Invalid user coordinates: lat=${userLat}, lng=${userLng}`);
      }
      if (Math.abs(restaurantLat) > 90 || Math.abs(restaurantLng) > 180) {
        throw new BadRequestException(
          `Invalid restaurant coordinates: lat=${restaurantLat}, lng=${restaurantLng}`,
        );
      }

      const routeResult = await this.mapboxService.calculateBikeRoute(
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
      order.user = user;
      order.restaurant = restaurant;
      order.total = orderCalculation.total;
      order.note = data.note || '';
      order.address = address;
      order.date = new Date().toISOString();
      order.deliveryDistance = deliveryDistance;
      order.shippingFee = orderCalculation.shippingFee;
      order.estimatedDeliveryTime = estimatedDeliveryTime;
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

      return this.orderQueryService.getOrderById(savedOrder.id);
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
      food: Food;
      quantity: number;
      selectedToppings?: { id: string; name: string; price: number }[];
      toppingTotal: number;
      discountPercent: number;
      discountedPrice: number;
      itemTotal: number;
    }> = [];

    for (const detail of orderDetails) {
      const food = await this.foodRepository.findOne({
        where: { id: detail.foodId },
        relations: ['toppings', 'restaurant'],
      });
      if (!food) throw new NotFoundException(`Food with ID ${detail.foodId} not found`);
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

      const basePrice = Number(food.price);
      const discountPercent = Number(food.discountPercent) || 0;
      const discountedPrice = basePrice - (basePrice * discountPercent) / 100;
      let toppingTotal = 0;
      const validatedToppings: Array<{ id: string; name: string; price: number }> = [];

      for (const selectedTopping of detail.selectedToppings || []) {
        const topping = await this.toppingRepository.findOne({
          where: { id: selectedTopping.id, food: { id: detail.foodId }, isAvailable: true },
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

    return { calculatedTotal, foodDetails };
  }

  private async createOrderDetails(
    order: Order,
    foodDetails: Awaited<ReturnType<typeof this.validateAndCalculateOrderDetails>>['foodDetails'],
    queryRunner: any,
  ) {
    for (const detail of foodDetails) {
      const orderDetail = new OrderDetail();
      orderDetail.order = order;
      orderDetail.food = detail.food;
      orderDetail.quantity = detail.quantity;
      orderDetail.price = String(detail.discountedPrice);
      const snapshot = createOrderItemSnapshot({
        foodId: detail.food.id,
        foodName: detail.food.name ?? '',
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
    estimatedDeliveryTime?: number;
  }) {
    const shippingFee = await this.systemConstraintsService.calculateShippingFee(
      data.deliveryDistance,
    );
    const maxDeliveryTime = await this.systemConstraintsService.getMaxDeliveryTime();
    const estimatedDeliveryTime =
      data.estimatedDeliveryTime ||
      Math.min(maxDeliveryTime, Math.ceil(data.deliveryDistance * 2) + 20);
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
      const discountedPrice = Number(food.price) - (Number(food.price) * discountPercent) / 100;
      const toppings: { id: string; unitPrice: number }[] = [];
      for (const selectedTopping of item.toppings || []) {
        const topping = await this.toppingRepository.findOne({
          where: { id: selectedTopping.id, food: { id: item.foodId }, isAvailable: true },
        });
        if (!topping)
          throw new BadRequestException(`Topping ${selectedTopping.id} is not orderable`);
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
      distance: Number(data.deliveryDistance.toFixed(2)),
      estimatedDeliveryTime,
      appliedPromotion,
      promotionError,
    };
  }
}
