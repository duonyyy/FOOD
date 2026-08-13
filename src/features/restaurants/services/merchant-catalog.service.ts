import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Restaurant } from 'src/entities/restaurant.entity';
import { Repository } from 'typeorm';
import {
  type MerchantCatalogPort,
  type MerchantRestaurantSnapshot,
} from '../contracts/merchant-catalog.port';

@Injectable()
export class MerchantCatalogService implements MerchantCatalogPort {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
  ) {}

  async assertCanManageRestaurant(restaurantId: string, actorId: string): Promise<void> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId },
      relations: ['owner'],
    });
    if (!restaurant) throw new NotFoundException('Restaurant not found');
    if (restaurant.owner?.id !== actorId) {
      throw new ForbiddenException('You can only manage menu items for your own restaurant');
    }
  }

  async findRestaurant(restaurantId: string): Promise<MerchantRestaurantSnapshot | null> {
    const restaurant = await this.restaurantRepository.findOne({ where: { id: restaurantId } });
    if (!restaurant) return null;

    return {
      restaurantId: restaurant.id,
      name: restaurant.name ?? '',
      latitude: restaurant.latitude == null ? null : Number(restaurant.latitude),
      longitude: restaurant.longitude == null ? null : Number(restaurant.longitude),
    };
  }
}
