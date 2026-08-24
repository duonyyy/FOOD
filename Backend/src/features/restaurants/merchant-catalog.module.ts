import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Restaurant } from 'src/entities/restaurant.entity';
import { MERCHANT_CATALOG } from './contracts/merchant-catalog.port';
import { MerchantCatalogService } from './services/merchant-catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([Restaurant])],
  providers: [
    MerchantCatalogService,
    { provide: MERCHANT_CATALOG, useExisting: MerchantCatalogService },
  ],
  exports: [MERCHANT_CATALOG],
})
export class MerchantCatalogModule {}
