import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionRedemption } from 'src/entities/promotion-redemption.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { AuthModule } from 'src/features/auth/auth-module.public-api';
import { AdminPromotionsController } from './controllers/admin-promotions.controller';
import { PublicPromotionsController } from './controllers/public-promotions.controller';
import { AdminPromotionsService } from './services/admin-promotions.service';
import { PromotionUsageService } from './services/promotion-usage.service';
import { PublicPromotionsService } from './services/public-promotions.service';

/** Owns promotion rules, CRUD, and usage tracking. */
@Module({
  imports: [TypeOrmModule.forFeature([Promotion, PromotionRedemption]), AuthModule],
  controllers: [PublicPromotionsController, AdminPromotionsController],
  providers: [PublicPromotionsService, AdminPromotionsService, PromotionUsageService],
  exports: [PublicPromotionsService, PromotionUsageService],
})
export class PromotionsModule {}
