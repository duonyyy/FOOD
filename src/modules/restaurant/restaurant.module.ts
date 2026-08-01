import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from 'src/entities/address.entity';
import { Food } from 'src/entities/food.entity';
import { Promotion } from 'src/entities/promotion.entity';
import { Restaurant } from 'src/entities/restaurant.entity';
import { User } from 'src/entities/user.entity';
import { MapsModule } from 'src/infra/maps/maps.module';
import { StorageModule } from 'src/infra/storage/storage.module';
import { UsersModule } from '../users/users.module';
import { RestaurantController } from './restaurant.controller';
import { RestaurantService } from './restaurant.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Restaurant, User, Address, Food, Promotion]),
    UsersModule,
    JwtModule,
    ConfigModule,
    StorageModule,
    MapsModule,
  ],
  controllers: [RestaurantController],
  providers: [RestaurantService],
  exports: [RestaurantService],
})
export class RestaurantModule {}
