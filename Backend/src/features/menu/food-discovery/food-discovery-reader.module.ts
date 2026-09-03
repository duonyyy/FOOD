import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from 'src/entities/food.entity';
import { CATALOG_CHAT_READER } from '../contracts/catalog-chat-reader.port';
import { FOOD_DISCOVERY_READER } from '../contracts/food-discovery-reader.port';
import { FoodDiscoveryReaderService } from './food-discovery-reader.service';

@Module({
  imports: [TypeOrmModule.forFeature([Food])],
  providers: [
    FoodDiscoveryReaderService,
    { provide: FOOD_DISCOVERY_READER, useExisting: FoodDiscoveryReaderService },
    { provide: CATALOG_CHAT_READER, useExisting: FoodDiscoveryReaderService },
  ],
  exports: [FOOD_DISCOVERY_READER, CATALOG_CHAT_READER],
})
export class FoodDiscoveryReaderModule {}
