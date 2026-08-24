import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import { Repository } from 'typeorm';
import {
  type ActiveRestaurantSnapshot,
  type RestaurantReaderPort,
} from '../contracts/restaurant-reader.port';

@Injectable()
export class RestaurantReaderService implements RestaurantReaderPort {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
  ) {}

  async findActiveRestaurant(restaurantId: string): Promise<ActiveRestaurantSnapshot | null> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId, status: RestaurantStatus.APPROVED },
      relations: ['owner'],
    });
    if (!restaurant?.owner) {
      return null;
    }
    return {
      restaurantId: restaurant.id,
      ownerId: restaurant.owner.id,
      name: restaurant.name ?? '',
      isActive: true,
      location:
        restaurant.latitude != null && restaurant.longitude != null
          ? { latitude: Number(restaurant.latitude), longitude: Number(restaurant.longitude) }
          : null,
    };
  }
}
