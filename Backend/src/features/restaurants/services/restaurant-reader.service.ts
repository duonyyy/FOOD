import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import { Repository } from 'typeorm';
import {
  type ActiveRestaurantSnapshot,
  type MessagingRestaurantSnapshot,
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
      relations: ['owner', 'address'],
    });
    if (!restaurant?.owner) {
      return null;
    }
    return {
      restaurantId: restaurant.id,
      ownerId: restaurant.owner.id,
      name: restaurant.name ?? '',
      isActive: true,
      location: this.toLocation(restaurant),
    };
  }

  async findRestaurantForMessaging(
    restaurantId: string,
  ): Promise<MessagingRestaurantSnapshot | null> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId },
      relations: ['owner'],
    });
    return restaurant?.owner ? this.toMessagingSnapshot(restaurant) : null;
  }

  async listActiveRestaurantsForMessaging(): Promise<MessagingRestaurantSnapshot[]> {
    const restaurants = await this.restaurantRepository.find({
      where: { status: RestaurantStatus.APPROVED },
      relations: ['owner'],
    });
    return restaurants
      .filter((restaurant) => Boolean(restaurant.owner))
      .map((restaurant) => this.toMessagingSnapshot(restaurant));
  }

  private toMessagingSnapshot(restaurant: Restaurant): MessagingRestaurantSnapshot {
    return {
      restaurantId: restaurant.id,
      ownerId: restaurant.owner.id,
      name: restaurant.name ?? '',
      isActive: restaurant.status === RestaurantStatus.APPROVED,
    };
  }

  private toLocation(restaurant: Restaurant): ActiveRestaurantSnapshot['location'] {
    const latitude = restaurant.address?.latitude ?? restaurant.latitude;
    const longitude = restaurant.address?.longitude ?? restaurant.longitude;
    return latitude != null && longitude != null
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : null;
  }
}
