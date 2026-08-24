import { Restaurant } from 'src/entities/restaurant.entity';
import { RestaurantResponseDto } from './dto/restaurant-response.dto';

type RestaurantWithDistance = Restaurant & {
  distance?: number | null;
  deliveryTime?: number | null;
};

export function toRestaurantResponse(restaurant: RestaurantWithDistance): RestaurantResponseDto {
  const address = restaurant.address;

  return {
    id: restaurant.id,
    name: restaurant.name ?? null,
    phoneNumber: restaurant.phoneNumber ?? null,
    avatar: restaurant.avatar ?? null,
    backgroundImage: restaurant.backgroundImage ?? null,
    description: restaurant.description ?? null,
    openTime: restaurant.openTime ?? null,
    closeTime: restaurant.closeTime ?? null,
    rating: restaurant.rating == null ? null : Number(restaurant.rating),
    status: restaurant.status,
    ownerId: restaurant.owner?.id ?? null,
    address: address
      ? {
          id: address.id,
          street: address.street ?? null,
          ward: address.ward ?? null,
          district: address.district ?? null,
          city: address.city ?? null,
          latitude: address.latitude == null ? null : Number(address.latitude),
          longitude: address.longitude == null ? null : Number(address.longitude),
        }
      : null,
    distance: restaurant.distance ?? null,
    deliveryTime: restaurant.deliveryTime ?? null,
  };
}
