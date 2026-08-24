/**
 * Narrow public entrypoint for Catalog consumers.
 *
 * It deliberately does not re-export RestaurantsModule: importing a merchant
 * ownership contract from Catalog must not pull the Restaurant feature back
 * into the Menu module graph.
 */
export {
  MERCHANT_CATALOG,
  type MerchantCatalogPort,
  type MerchantRestaurantSnapshot,
} from './contracts/merchant-catalog.port';
export { MerchantCatalogModule } from './merchant-catalog.module';
