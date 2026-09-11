import { BadRequestException, Injectable } from '@nestjs/common';
import {
  PromotionRedemption,
  PromotionRedemptionStatus,
} from 'src/entities/promotion-redemption.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { EntityManager } from 'typeorm';
import { PromotionService } from './promotion.service';

export interface RedeemPromotionRequest {
  orderId: string;
  promotionCode: string;
  customerId: string;
  subtotal: number;
  discountAmount: number;
}

@Injectable()
export class PromotionRedemptionService {
  constructor(private readonly promotionService: PromotionService) {}

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

    const promotionRepository = manager.getRepository(Promotion);
    const promotion = await promotionRepository.findOne({
      where: { code: request.promotionCode },
      lock: { mode: 'pessimistic_write' },
    });
    if (!promotion) throw new BadRequestException('Promotion code not found');

    // The increment and redemption insert share the caller's transaction.
    await this.promotionService.usePromotion(request.promotionCode, request.subtotal, manager);

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
}
