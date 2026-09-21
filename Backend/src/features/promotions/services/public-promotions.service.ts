import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Promotion, PromotionType } from 'src/entities/promotion.entity';
import { AppCacheService } from 'src/infra/cache/public-api';
import { Repository } from 'typeorm';
import {
  buildPromotionCacheKey,
  PROMOTION_CACHE_TTL_SECONDS,
} from '../contracts/promotion-cache.policy';
import {
  calculatePromotionDiscount,
  checkPromotionRules,
} from '../contracts/promotion-rules.policy';

@Injectable()
export class PublicPromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepository: Repository<Promotion>,
    private readonly cacheService: AppCacheService,
  ) {}

  async getActivePromotions(): Promise<Promotion[]> {
    return this.cacheService.remember(
      buildPromotionCacheKey('promotion:active'),
      PROMOTION_CACHE_TTL_SECONDS.MEDIUM,
      async () => {
        const now = new Date();
        return this.promotionRepository
          .createQueryBuilder('promotion')
          .where('(promotion.startDate IS NULL OR promotion.startDate <= :now)', { now })
          .andWhere('(promotion.endDate IS NULL OR promotion.endDate >= :now)', { now })
          .andWhere('(promotion.maxUsage IS NULL OR promotion.numberOfUsed < promotion.maxUsage)')
          .getMany();
      },
    );
  }

  async getActivePromotionsByType(type: PromotionType): Promise<Promotion[]> {
    return this.cacheService.remember(
      buildPromotionCacheKey('promotion:activeByType', { type }),
      PROMOTION_CACHE_TTL_SECONDS.MEDIUM,
      async () => {
        const now = new Date();
        return this.promotionRepository
          .createQueryBuilder('promotion')
          .where('promotion.type = :type', { type })
          .andWhere('(promotion.startDate IS NULL OR promotion.startDate <= :now)', { now })
          .andWhere('(promotion.endDate IS NULL OR promotion.endDate >= :now)', { now })
          .andWhere('(promotion.maxUsage IS NULL OR promotion.numberOfUsed < promotion.maxUsage)')
          .getMany();
      },
    );
  }

  async getPromotionByCode(code: string): Promise<Promotion> {
    const promotion = await this.cacheService.remember(
      buildPromotionCacheKey('promotion:code', { code }),
      PROMOTION_CACHE_TTL_SECONDS.MEDIUM,
      () => this.promotionRepository.findOne({ where: { code } }),
    );
    if (!promotion) throw new NotFoundException('Promotion not found');
    return promotion;
  }

  async validatePromotion(
    code: string,
    orderValue?: number,
  ): Promise<{
    valid: boolean;
    promotion?: Promotion;
    reason?: string;
    calculatedDiscount?: number;
  }> {
    const promotion = await this.promotionRepository.findOne({ where: { code } });

    if (!promotion) {
      return { valid: false, reason: 'Promotion code not found' };
    }

    const ruleCheck = checkPromotionRules(promotion, orderValue);
    if (!ruleCheck.valid) {
      return ruleCheck;
    }

    return {
      valid: true,
      promotion,
      calculatedDiscount: orderValue ? calculatePromotionDiscount(promotion, orderValue) : 0,
    };
  }

  calculateDiscount(promotion: Promotion, orderAmount: number): number {
    return calculatePromotionDiscount(promotion, orderAmount);
  }

  async getAllPromotionsWithPagination(
    page = 1,
    pageSize = 10,
    type?: PromotionType,
  ): Promise<{
    items: Promotion[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const cacheKey = buildPromotionCacheKey('promotion:allPaginated', {
      page,
      pageSize,
      type,
    });
    return this.cacheService.remember(cacheKey, PROMOTION_CACHE_TTL_SECONDS.MEDIUM, async () => {
      const queryBuilder = this.promotionRepository.createQueryBuilder('promotion');

      if (type) {
        queryBuilder.where('promotion.type = :type', { type });
      }

      const [items, totalItems] = await queryBuilder
        .orderBy('promotion.id', 'DESC')
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

      return {
        items,
        totalItems,
        page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
      };
    });
  }

  async getActivePromotionsWithPagination(
    page = 1,
    pageSize = 10,
    type?: PromotionType,
    name?: string,
  ): Promise<{
    items: Promotion[];
    totalItems: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const cacheKey = buildPromotionCacheKey('promotion:activePaginated', {
      page,
      pageSize,
      type,
      name,
    });
    return this.cacheService.remember(cacheKey, PROMOTION_CACHE_TTL_SECONDS.MEDIUM, async () => {
      const now = new Date();
      const queryBuilder = this.promotionRepository
        .createQueryBuilder('promotion')
        .where('(promotion.startDate IS NULL OR promotion.startDate <= :now)', { now })
        .andWhere('(promotion.endDate IS NULL OR promotion.endDate >= :now)', { now })
        .andWhere('(promotion.maxUsage IS NULL OR promotion.numberOfUsed < promotion.maxUsage)');

      if (type) {
        queryBuilder.andWhere('promotion.type = :type', { type });
      }
      if (name) {
        queryBuilder.andWhere('LOWER(promotion.description) LIKE :name', {
          name: `%${name.toLowerCase()}%`,
        });
      }

      const [items, totalItems] = await queryBuilder
        .orderBy('promotion.id', 'DESC')
        .skip((page - 1) * pageSize)
        .take(pageSize)
        .getManyAndCount();

      return {
        items,
        totalItems,
        page,
        pageSize,
        totalPages: Math.ceil(totalItems / pageSize),
      };
    });
  }
}
