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
