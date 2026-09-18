export interface RestaurantForOrder {
  restaurantId: string;
  ownerId: string;
  isActive: boolean;
  location: RestaurantDeliveryLocation | null;
}

export interface RestaurantDeliveryLocation {
  latitude: number | null;
  longitude: number | null;
}

export interface MessagingRestaurant {
  restaurantId: string;
  ownerId: string;
  name: string;
  isActive: boolean;
}
