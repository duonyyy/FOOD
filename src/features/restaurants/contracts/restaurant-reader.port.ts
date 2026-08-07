export const RESTAURANT_READER = Symbol('RESTAURANT_READER');

export interface RestaurantReaderPort {
  findActiveRestaurant(restaurantId: string): Promise<ActiveRestaurantSnapshot | null>;
}

export interface ActiveRestaurantSnapshot {
  restaurantId: string;
  ownerId: string;
  name: string;
  isActive: boolean;
  location: RestaurantLocationSnapshot | null;
}

export interface RestaurantLocationSnapshot {
  latitude: number | null;
  longitude: number | null;
}
