import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Promotion } from 'src/entities/promotion.entity';
import { AppCacheService } from 'src/infra/cache/public-api';
import { StorageService } from 'src/infra/minio/public-api';
import { Repository } from 'typeorm';
import {
  buildPromotionCacheKey,
  PROMOTION_CACHE_TTL_SECONDS,
} from '../contracts/promotion-cache.policy';
import { CreatePromotionDto } from '../dto/create-promotion.dto';
import { UpdatePromotionDto } from '../dto/update-promotion.dto';

@Injectable()
export class AdminPromotionsService {
  constructor(
    @InjectRepository(Promotion)
    private readonly promotionRepository: Repository<Promotion>,
    private readonly storage: StorageService,
    private readonly cacheService: AppCacheService,
  ) {}

  async createPromotion(data: CreatePromotionDto): Promise<Promotion> {
    this.validateCreateInput(data);

    const promotion = this.promotionRepository.create({
      description: data.description,
      type: data.type,
      discountPercent: data.discountPercent,
      discountAmount: data.discountAmount,
      minOrderValue: data.minOrderValue,
      maxDiscountAmount: data.maxDiscountAmount,
      code: data.code,
      image: data.image,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      maxUsage: data.maxUsage,
      numberOfUsed: 0,
    });

    const savedPromotion = await this.promotionRepository.save(promotion);
    await this.clearPromotionCache();
    return savedPromotion;
  }

  async getAllPromotions(): Promise<Promotion[]> {
    return this.cacheService.remember(
      buildPromotionCacheKey('promotion:all'),
      PROMOTION_CACHE_TTL_SECONDS.LONG,
      () => this.promotionRepository.find(),
    );
  }

  async getPromotionById(id: string): Promise<Promotion> {
    const promotion = await this.promotionRepository.findOne({ where: { id } });
    if (!promotion) throw new NotFoundException('Promotion not found');
    return promotion;
  }

  async updatePromotion(id: string, data: UpdatePromotionDto): Promise<Promotion> {
    const promotion = await this.getPromotionById(id);
    this.validateUpdateInput(promotion, data);

    if (promotion.image && data.image && promotion.image !== data.image) {
      await this.storage.deleteFile(promotion.image);
    }

    const updateData: Partial<
      Pick<
        Promotion,
        | 'description'
        | 'type'
        | 'discountPercent'
        | 'discountAmount'
        | 'minOrderValue'
        | 'maxDiscountAmount'
        | 'code'
        | 'image'
        | 'maxUsage'
        | 'startDate'
        | 'endDate'
      >
    > = {};

    if (data.description !== undefined) updateData.description = data.description;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.discountPercent !== undefined) updateData.discountPercent = data.discountPercent;
    if (data.discountAmount !== undefined) updateData.discountAmount = data.discountAmount;
    if (data.minOrderValue !== undefined) updateData.minOrderValue = data.minOrderValue;
    if (data.maxDiscountAmount !== undefined) updateData.maxDiscountAmount = data.maxDiscountAmount;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.image !== undefined) updateData.image = data.image;
    if (data.maxUsage !== undefined) updateData.maxUsage = data.maxUsage;
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);

    await this.promotionRepository.update(id, updateData);
    await this.clearPromotionCache();
    return this.getPromotionById(id);
  }

  async deletePromotion(id: string): Promise<{ message: string }> {
    const promotion = await this.getPromotionById(id);

    if (promotion.image) {
      await this.storage.deleteFile(promotion.image);
    }

    const result = await this.promotionRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException('Promotion not found');
    await this.clearPromotionCache();
    return { message: 'Promotion deleted successfully' };
  }

  async resetPromotionUsage(id: string): Promise<Promotion> {
    await this.promotionRepository.update(id, { numberOfUsed: 0 });
    await this.clearPromotionCache();
    return this.getPromotionById(id);
  }

  private async clearPromotionCache(): Promise<void> {
    await this.cacheService.deleteByPattern('promotion:*');
  }

  private validateCreateInput(data: CreatePromotionDto): void {
    if (data.startDate && data.endDate && new Date(data.startDate) >= new Date(data.endDate)) {
      throw new BadRequestException('Start date must be before end date');
    }

    if (!data.discountPercent && !data.discountAmount) {
      throw new BadRequestException('Either discountPercent or discountAmount must be provided');
    }

    if (data.discountPercent && data.discountAmount) {
      throw new BadRequestException('Cannot provide both discountPercent and discountAmount');
    }

    if (data.discountPercent && (data.discountPercent < 0 || data.discountPercent > 100)) {
      throw new BadRequestException('Discount percent must be between 0 and 100');
    }
  }

  private validateUpdateInput(promotion: Promotion, data: UpdatePromotionDto): void {
    const startDate = data.startDate ? new Date(data.startDate) : promotion.startDate;
    const endDate = data.endDate ? new Date(data.endDate) : promotion.endDate;

    if (startDate && endDate && startDate >= endDate) {
      throw new BadRequestException('Start date must be before end date');
    }

    const discountPercent =
      data.discountPercent !== undefined ? data.discountPercent : promotion.discountPercent;
    const discountAmount =
      data.discountAmount !== undefined ? data.discountAmount : promotion.discountAmount;

    if (!discountPercent && !discountAmount) {
      throw new BadRequestException('Either discountPercent or discountAmount must be provided');
    }

    if (discountPercent && discountAmount) {
      throw new BadRequestException('Cannot provide both discountPercent and discountAmount');
    }
  }
}
