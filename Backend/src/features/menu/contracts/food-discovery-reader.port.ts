export const FOOD_DISCOVERY_READER = Symbol('FOOD_DISCOVERY_READER');

export interface FoodDiscoveryReaderPort {
  listRestaurantFoods(
    restaurantId: string,
    page: number,
    pageSize: number,
  ): Promise<FoodPreviewSnapshot[]>;
}

export interface FoodPreviewSnapshot {
  foodId: string;
  name: string | null;
  image: string | null;
  price: number | null;
  rating: number | null;
  soldCount: number | null;
}
