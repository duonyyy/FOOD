import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Restaurant } from 'src/entities/restaurant.entity';
import { MerchantCatalogService } from './services/merchant-catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([Restaurant])],
  providers: [MerchantCatalogService],
  exports: [MerchantCatalogService],
})
export class MerchantCatalogModule {}
