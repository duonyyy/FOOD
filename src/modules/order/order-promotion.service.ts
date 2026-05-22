import { Injectable, Logger } from '@nestjs/common';
import { Promotion, PromotionType } from 'src/entities/promotion.entity';
import { PromotionService } from '../promotion/promotion.service';

@Injectable()
export class OrderPromotionService {
  private readonly logger = new Logger(OrderPromotionService.name);

  constructor(private readonly promotionService: PromotionService) {}

  async validatePromotion(
    code: string | undefined,
    subtotal: number,
  ): Promise<{
    appliedPromotion: Promotion | null;
    promotionDiscount: number;
    promotionError: string | null;
  }> {
    if (!code) {
      return {
        appliedPromotion: null,
        promotionDiscount: 0,
        promotionError: null,
      };
    }

    const validation = await this.promotionService.validatePromotion(
      code,
      subtotal,
    );
    if (validation.valid && validation.promotion) {
      return {
        appliedPromotion: validation.promotion,
        promotionDiscount: validation.calculatedDiscount || 0,
        promotionError: null,
      };
    }

    return {
      appliedPromotion: null,
      promotionDiscount: 0,
      promotionError: validation.reason || 'Invalid promotion code.',
    };
  }

  async validateCustomAddressPromotion(
    code: string | undefined,
    foodTotal: number,
    shippingFee: number,
  ): Promise<{
    appliedPromotion: Promotion | null;
    promotionDiscount: number;
    promotionError: string | null;
  }> {
    if (!code) {
      return {
        appliedPromotion: null,
        promotionDiscount: 0,
        promotionError: null,
      };
    }

    try {
      const validation = await this.promotionService.validatePromotion(
        code,
        foodTotal + shippingFee,
      );
      if (validation.valid && validation.promotion) {
        const promotion = validation.promotion;
        let promotionDiscount = 0;

        if (promotion.type === PromotionType.FOOD_DISCOUNT) {
          promotionDiscount = this.promotionService.calculateDiscount(
            promotion,
            foodTotal,
          );
        } else if (promotion.type === PromotionType.SHIPPING_DISCOUNT) {
          promotionDiscount = Math.min(
            this.promotionService.calculateDiscount(promotion, shippingFee),
            shippingFee,
          );
        }

        return {
          appliedPromotion: promotion,
          promotionDiscount,
          promotionError: null,
        };
      }

      return {
        appliedPromotion: null,
        promotionDiscount: 0,
        promotionError: validation.reason || 'Invalid promotion code',
      };
    } catch (error) {
      this.logger.error(`Promotion validation error: ${error.message}`);
      return {
        appliedPromotion: null,
        promotionDiscount: 0,
        promotionError: 'Failed to validate promotion code',
      };
    }
  }

  async usePromotion(code: string, subtotal: number): Promise<void> {
    await this.promotionService.usePromotion(code, subtotal);
  }
}
