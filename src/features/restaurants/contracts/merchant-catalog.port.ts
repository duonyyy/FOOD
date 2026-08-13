export const MERCHANT_CATALOG = Symbol('MERCHANT_CATALOG');

export interface MerchantRestaurantSnapshot {
  restaurantId: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
}

export interface MerchantCatalogPort {
  assertCanManageRestaurant(restaurantId: string, actorId: string): Promise<void>;
  findRestaurant(restaurantId: string): Promise<MerchantRestaurantSnapshot | null>;
}
