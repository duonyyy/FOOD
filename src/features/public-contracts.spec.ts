import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DELIVERY_QUOTE_PORT } from './delivery/public-api';
import { GEOCODING_PORT, LOCATION_READER, type LocationReaderPort } from './locations/public-api';
import {
  CATEGORY_READER,
  MENU_READER,
  type CategoryReaderPort,
  type MenuReaderPort,
} from './menu/public-api';
import { PROMOTION_REDEMPTION_PORT, type PromotionRedemptionPort } from './promotions/public-api';
import { RESTAURANT_READER, type RestaurantReaderPort } from './restaurants/public-api';

describe('feature public contracts', () => {
  it('exports one distinct injection token for every cross-feature contract', () => {
    const tokens = [
      MENU_READER,
      CATEGORY_READER,
      RESTAURANT_READER,
      LOCATION_READER,
      GEOCODING_PORT,
      PROMOTION_REDEMPTION_PORT,
      DELIVERY_QUOTE_PORT,
    ];

    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('keeps port method signatures independent from ORM entities', () => {
    const menuReader: MenuReaderPort = {
      getOrderableItems: () => Promise.resolve([]),
    };
    const categoryReader: CategoryReaderPort = {
      findCategoryById: () => Promise.resolve(null),
    };
    const restaurantReader: RestaurantReaderPort = {
      findActiveRestaurant: () => Promise.resolve(null),
    };
    const promotionRedemption: PromotionRedemptionPort = {
      reservePromotion: () =>
        Promise.resolve({
          reservationId: 'reservation-id',
          promotionId: 'promotion-id',
          promotionCode: 'WELCOME',
          discountAmount: 10_000,
          expiresAt: null,
        }),
      commitReservation: () => Promise.resolve(),
      releaseReservation: () => Promise.resolve(),
    };
    const locationReader: LocationReaderPort = {
      findAddress: () => Promise.resolve(null),
      findTemporaryAddress: () => Promise.resolve(null),
    };

    expect(menuReader).toBeDefined();
    expect(categoryReader).toBeDefined();
    expect(restaurantReader).toBeDefined();
    expect(promotionRedemption).toBeDefined();
    expect(locationReader).toBeDefined();

    const contractPaths = [
      'src/features/menu/contracts/menu-reader.port.ts',
      'src/features/menu/contracts/category-reader.port.ts',
      'src/features/restaurants/contracts/restaurant-reader.port.ts',
      'src/features/locations/contracts/location-reader.port.ts',
      'src/features/locations/contracts/geocoding.port.ts',
      'src/features/promotions/contracts/promotion-redemption.port.ts',
      'src/features/delivery/contracts/delivery-quote.port.ts',
    ];

    for (const contractPath of contractPaths) {
      const source = readFileSync(resolve(process.cwd(), contractPath), 'utf8');

      expect(source).not.toMatch(/typeorm|entities\//i);
    }
  });
});
