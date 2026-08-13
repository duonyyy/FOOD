import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Food } from 'src/entities/food.entity';
import { Order } from 'src/entities/order.entity';
import { PromotionRedemption } from 'src/entities/promotion-redemption.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { StorageModule } from 'src/infra/storage/storage.module';
import { PromotionRedemptionService } from './promotion-redemption.service';
import { PromotionController } from './promotion.controller';
import { PromotionService } from './promotion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Promotion, PromotionRedemption, Food, Order]),
    StorageModule,
    AuthModule,
  ],
  controllers: [PromotionController],
  providers: [PromotionService, PromotionRedemptionService],
  exports: [PromotionService, PromotionRedemptionService],
})
export class PromotionModule {}
