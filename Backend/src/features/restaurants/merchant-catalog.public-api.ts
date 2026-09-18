/**
 * Narrow public entrypoint for Catalog consumers.
 *
 * It deliberately does not re-export RestaurantsModule: importing a merchant
 * ownership contract from Catalog must not pull the Restaurant feature back
 * into the Menu module graph.
 */
export { MerchantCatalogModule } from './merchant-catalog.module';
export { MerchantCatalogService } from './services/merchant-catalog.service';
export type { MerchantRestaurantLocation } from './types/merchant-catalog.types';
