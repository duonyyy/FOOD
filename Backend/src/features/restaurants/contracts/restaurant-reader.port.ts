export const RESTAURANT_READER = Symbol('RESTAURANT_READER');

export interface RestaurantReaderPort {
  findActiveRestaurant(restaurantId: string): Promise<ActiveRestaurantSnapshot | null>;
  findRestaurantForMessaging(restaurantId: string): Promise<MessagingRestaurantSnapshot | null>;
  listActiveRestaurantsForMessaging(): Promise<MessagingRestaurantSnapshot[]>;
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

export interface MessagingRestaurantSnapshot {
  restaurantId: string;
  ownerId: string;
  name: string;
  isActive: boolean;
}
