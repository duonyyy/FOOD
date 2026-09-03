export const CATALOG_CHAT_READER = Symbol('CATALOG_CHAT_READER');

export interface CatalogChatReaderPort {
  listAvailableFoods(): Promise<CatalogChatFoodSnapshot[]>;
  findAvailableFood(foodId: string, restaurantId?: string): Promise<CatalogChatFoodSnapshot | null>;
}

export interface CatalogChatFoodSnapshot {
  foodId: string;
  restaurantId: string;
  restaurantName: string;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
}
