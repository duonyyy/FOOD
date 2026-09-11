import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionRedemption } from 'src/entities/promotion-redemption.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { PromotionController } from './controllers/promotion.controller';
import { PromotionRedemptionService } from './services/promotion-redemption.service';
import { PromotionService } from './services/promotion.service';

/** Owns promotion eligibility, CRUD, and redemption. */
@Module({
  imports: [TypeOrmModule.forFeature([Promotion, PromotionRedemption]), AuthModule],
  controllers: [PromotionController],
  providers: [PromotionService, PromotionRedemptionService],
  exports: [PromotionService, PromotionRedemptionService],
})
export class PromotionsModule {}
