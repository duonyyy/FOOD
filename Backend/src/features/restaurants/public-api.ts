export {
  MERCHANT_CATALOG,
  type MerchantCatalogPort,
  type MerchantRestaurantSnapshot,
} from './contracts/merchant-catalog.port';
export {
  RESTAURANT_READER,
  type ActiveRestaurantSnapshot,
  type MessagingRestaurantSnapshot,
  type RestaurantLocationSnapshot,
  type RestaurantReaderPort,
} from './contracts/restaurant-reader.port';
export { MerchantCatalogModule } from './merchant-catalog.module';
export { RestaurantsModule } from './restaurants.module';
export { RestaurantProfileService } from './services/restaurant-profile.service';
