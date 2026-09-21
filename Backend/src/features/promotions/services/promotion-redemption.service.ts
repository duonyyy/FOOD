import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PromotionRedemption,
  PromotionRedemptionStatus,
} from 'src/entities/promotion-redemption.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { AppCacheService } from 'src/infra/cache/public-api';
import { EntityManager } from 'typeorm';
import { validatePromotionEligibility } from '../contracts/promotion-eligibility.policy';

export interface RedeemPromotionRequest {
  orderId: string;
  promotionCode: string;
  customerId: string;
  subtotal: number;
  discountAmount: number;
}

@Injectable()
export class PromotionRedemptionService {
  constructor(private readonly cacheService: AppCacheService) {}

  async redeemInTransaction(
    request: RedeemPromotionRequest,
    manager: EntityManager,
  ): Promise<PromotionRedemption> {
    const redemptionRepository = manager.getRepository(PromotionRedemption);
    const existing = await redemptionRepository.findOne({
      where: { orderId: request.orderId },
      relations: ['promotion'],
      lock: { mode: 'pessimistic_write' },
    });

    if (existing) {
      if (existing.promotionCode !== request.promotionCode) {
        throw new BadRequestException('Order already has a different promotion redemption');
      }
      return existing;
    }

    const promotion = await this.usePromotion(request.promotionCode, request.subtotal, manager);

    return redemptionRepository.save(
      redemptionRepository.create({
        orderId: request.orderId,
        customerId: request.customerId,
        promotion,
        promotionCode: promotion.code,
        discountAmount: request.discountAmount,
        status: PromotionRedemptionStatus.COMMITTED,
      }),
    );
  }

  async clearPromotionCache(): Promise<void> {
    await this.cacheService.deleteByPattern('promotion:*');
  }

  private async usePromotion(
    code: string,
    orderValue: number | undefined,
    manager: EntityManager,
  ): Promise<Promotion> {
    const promotionRepository = manager.getRepository(Promotion);
    const promotion = await promotionRepository.findOne({
      where: { code },
      lock: { mode: 'pessimistic_write' },
    });

    if (!promotion) {
      throw new BadRequestException('Promotion code not found');
    }

    const eligibility = validatePromotionEligibility(promotion, orderValue);
    if (!eligibility.valid) {
      throw new BadRequestException(eligibility.reason || 'Invalid promotion');
    }

    promotion.numberOfUsed = Number(promotion.numberOfUsed || 0) + 1;
    return promotionRepository.save(promotion);
  }
}
