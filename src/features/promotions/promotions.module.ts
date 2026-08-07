import { Module } from '@nestjs/common';
import { PromotionModule } from '../../modules/promotion/promotion.module';

/** Compatibility shell for promotion eligibility and redemption. */
@Module({ imports: [PromotionModule] })
export class PromotionsModule {}
