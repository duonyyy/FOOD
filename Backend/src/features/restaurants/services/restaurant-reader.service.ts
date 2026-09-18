import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Restaurant, RestaurantStatus } from 'src/entities/restaurant.entity';
import { Repository } from 'typeorm';
import {
  type MessagingRestaurant,
  type RestaurantForOrder,
} from '../types/restaurant-reader.types';

@Injectable()
export class RestaurantReaderService {
  constructor(
    @InjectRepository(Restaurant)
    private readonly restaurantRepository: Repository<Restaurant>,
  ) {}

  async findActiveRestaurant(restaurantId: string): Promise<RestaurantForOrder | null> {
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
      isActive: true,
      location: this.toLocation(restaurant),
    };
  }

  async findRestaurantForMessaging(
    restaurantId: string,
  ): Promise<MessagingRestaurant | null> {
    const restaurant = await this.restaurantRepository.findOne({
      where: { id: restaurantId },
      relations: ['owner'],
    });
    return restaurant?.owner ? this.toMessagingRestaurant(restaurant) : null;
  }

  async listActiveRestaurantsForMessaging(): Promise<MessagingRestaurant[]> {
    const restaurants = await this.restaurantRepository.find({
      where: { status: RestaurantStatus.APPROVED },
      relations: ['owner'],
    });
    return restaurants
      .filter((restaurant) => Boolean(restaurant.owner))
      .map((restaurant) => this.toMessagingRestaurant(restaurant));
  }

  private toMessagingRestaurant(restaurant: Restaurant): MessagingRestaurant {
    return {
      restaurantId: restaurant.id,
      ownerId: restaurant.owner.id,
      name: restaurant.name ?? '',
      isActive: restaurant.status === RestaurantStatus.APPROVED,
    };
  }

  private toLocation(restaurant: Restaurant): RestaurantForOrder['location'] {
    const latitude = restaurant.address?.latitude ?? restaurant.latitude;
    const longitude = restaurant.address?.longitude ?? restaurant.longitude;
    return latitude != null && longitude != null
      ? { latitude: Number(latitude), longitude: Number(longitude) }
      : null;
  }
}
