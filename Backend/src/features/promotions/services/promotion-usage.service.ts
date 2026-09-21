import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PromotionRedemption,
  PromotionRedemptionStatus,
} from 'src/entities/promotion-redemption.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { AppCacheService } from 'src/infra/cache/public-api';
import { EntityManager } from 'typeorm';
import { checkPromotionRules } from '../contracts/promotion-rules.policy';

export interface UsePromotionRequest {
  orderId: string;
  promotionCode: string;
  customerId: string;
  subtotal: number;
  discountAmount: number;
}

@Injectable()
export class PromotionUsageService {
  constructor(private readonly cacheService: AppCacheService) {}

  async useInTransaction(
    request: UsePromotionRequest,
    manager: EntityManager,
  ): Promise<PromotionRedemption> {
    const usageRepository = manager.getRepository(PromotionRedemption);
    const existingUsage = await usageRepository.findOne({
      where: { orderId: request.orderId },
      relations: ['promotion'],
      lock: { mode: 'pessimistic_write' },
    });

    if (existingUsage) {
      if (existingUsage.promotionCode !== request.promotionCode) {
        throw new BadRequestException('Order already has a different promotion usage');
      }
      return existingUsage;
    }

    const promotion = await this.incrementPromotionUsage(
      request.promotionCode,
      request.subtotal,
      manager,
    );

    return usageRepository.save(
      usageRepository.create({
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

  private async incrementPromotionUsage(
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

    const ruleCheck = checkPromotionRules(promotion, orderValue);
    if (!ruleCheck.valid) {
      throw new BadRequestException(ruleCheck.reason || 'Invalid promotion');
    }

    promotion.numberOfUsed = Number(promotion.numberOfUsed || 0) + 1;
    return promotionRepository.save(promotion);
  }
}
