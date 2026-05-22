import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Food } from 'src/entities/food.entity';
import { SystemConstraintsService } from 'src/services/system-constraints.service';
import {
  CustomAddressCalculationResult,
  OrderCalculationItem,
  OrderCalculationResult,
} from './dto/order-calculation.types';
import { OrderPromotionService } from './order-promotion.service';

@Injectable()
export class OrderPricingService {
  constructor(
    @InjectRepository(Food)
    private readonly foodRepository: Repository<Food>,
    private readonly systemConstraintsService: SystemConstraintsService,
    private readonly orderPromotionService: OrderPromotionService,
  ) {}

  async calculateOrderWithConstraints(data: {
    items: OrderCalculationItem[];
    promotionCode?: string;
    deliveryDistance: number;
    estimatedDeliveryTime?: number;
  }): Promise<OrderCalculationResult> {
    const shippingFee =
      await this.systemConstraintsService.calculateShippingFee(
        data.deliveryDistance,
      );
    const maxDeliveryTime =
      await this.systemConstraintsService.getMaxDeliveryTime();
    const estimatedDeliveryTime =
      data.estimatedDeliveryTime ||
      Math.min(maxDeliveryTime, Math.ceil(data.deliveryDistance * 2) + 20);

    const shipperCommissionRate = 0.8;
    const shipperEarnings = Math.round(shippingFee * shipperCommissionRate);
    const platformFee = shippingFee - shipperEarnings;
    const foodTotal = await this.calculateFoodTotal(data.items, true);
    const subtotal = foodTotal + shippingFee;
    const promotion = await this.orderPromotionService.validatePromotion(
      data.promotionCode,
      subtotal,
    );
    const total = Math.max(0, subtotal - promotion.promotionDiscount);

    return {
      foodTotal,
      shippingFee,
      shipperEarnings,
      shipperCommissionRate,
      platformFee,
      distance: Number(data.deliveryDistance.toFixed(2)),
      subtotal,
      promotionDiscount: promotion.promotionDiscount,
      total,
      estimatedDeliveryTime,
      appliedPromotion: promotion.appliedPromotion,
      promotionError: promotion.promotionError,
    };
  }

  async calculateCustomAddressOrder(data: {
    items: OrderCalculationItem[];
    promotionCode?: string;
    deliveryDistance: number;
    estimatedDeliveryTime: number;
  }): Promise<CustomAddressCalculationResult> {
    const shippingFee =
      await this.systemConstraintsService.calculateShippingFee(
        data.deliveryDistance,
      );
    const foodTotal = await this.calculateFoodTotal(data.items, false);
    const promotion =
      await this.orderPromotionService.validateCustomAddressPromotion(
        data.promotionCode,
        foodTotal,
        shippingFee,
      );
    const subtotal = foodTotal + shippingFee;
    const total = Math.max(0, subtotal - promotion.promotionDiscount);

    return {
      foodTotal,
      shippingFee,
      distance: data.deliveryDistance,
      estimatedDeliveryTime: data.estimatedDeliveryTime,
      subtotal,
      promotionDiscount: promotion.promotionDiscount,
      total,
      appliedPromotion: promotion.appliedPromotion
        ? {
            id: promotion.appliedPromotion.id,
            code: promotion.appliedPromotion.code,
            description: promotion.appliedPromotion.description,
            type: promotion.appliedPromotion.type,
            discountAmount: promotion.promotionDiscount,
          }
        : null,
      promotionError: promotion.promotionError,
    };
  }

  private async calculateFoodTotal(
    items: OrderCalculationItem[],
    useFoodDiscountFallback: boolean,
  ): Promise<number> {
    const foodIds = [...new Set(items.map((item) => item.foodId))];
    const foods = foodIds.length
      ? await this.foodRepository.find({ where: { id: In(foodIds) } })
      : [];
    const foodsById = new Map(foods.map((food) => [food.id, food]));

    return items.reduce((total, item) => {
      const food = foodsById.get(item.foodId);
      if (!food) return total;

      const discountPercent = useFoodDiscountFallback
        ? item.discountPercent || food.discountPercent || 0
        : (item.discountPercent ?? 0);
      const discountedPrice =
        Number(food.price) - (Number(food.price) * discountPercent) / 100;
      const toppingTotal = (item.toppings || []).reduce(
        (sum, topping) => sum + Number(topping.price),
        0,
      );

      return total + (discountedPrice + toppingTotal) * item.quantity;
    }, 0);
  }
}
