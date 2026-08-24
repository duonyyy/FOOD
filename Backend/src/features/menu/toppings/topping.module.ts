import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { Topping } from 'src/entities/topping.entity';
import { MerchantCatalogModule } from '../../restaurants/merchant-catalog.public-api';
import { ToppingCommandService } from './topping-command.service';

@Module({
  imports: [TypeOrmModule.forFeature([Food, Topping]), MerchantCatalogModule],
  providers: [ToppingCommandService],
  exports: [ToppingCommandService],
})
export class ToppingModule {}
