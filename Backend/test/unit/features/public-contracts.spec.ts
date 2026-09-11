import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DELIVERY_QUOTE_PORT } from 'src/features/delivery/public-api';
import {
  GEOCODING_PORT,
  LOCATION_READER,
  type LocationReaderPort,
} from 'src/features/locations/public-api';
import {
  CATEGORY_READER,
  FOOD_DISCOVERY_READER,
  FOOD_REVIEW_TARGET_READER,
  MENU_READER,
  type CategoryReaderPort,
  type FoodReviewTargetReaderPort,
  type MenuReaderPort,
} from 'src/features/menu/public-api';
import {
  ORDER_ANALYTICS_READER,
  ORDER_REVIEW_ELIGIBILITY_READER,
  type OrderReviewEligibilityReaderPort,
} from 'src/features/orders/public-api';
import {
  PAYMENT_CHECKOUT_COMMANDS,
  type PaymentCheckoutCommandsPort,
} from 'src/features/payments/public-api';
import {
  PROMOTION_REDEMPTION_PORT,
  type PromotionRedemptionPort,
} from 'src/features/promotions/public-api';
import { RESTAURANT_READER, type RestaurantReaderPort } from 'src/features/restaurants/public-api';
import {
  ORDER_REVIEW_READER,
  type OrderReviewReaderPort,
} from 'src/features/reviews/review-reader.public-api';
import { IDENTITY_READER, type IdentityReaderPort } from 'src/features/users/public-api';

describe('feature public contracts', () => {
  it('exports one distinct injection token for every cross-feature contract', () => {
    const tokens = [
      MENU_READER,
      CATEGORY_READER,
      RESTAURANT_READER,
      LOCATION_READER,
      GEOCODING_PORT,
      PROMOTION_REDEMPTION_PORT,
      PAYMENT_CHECKOUT_COMMANDS,
      DELIVERY_QUOTE_PORT,
      IDENTITY_READER,
      FOOD_REVIEW_TARGET_READER,
      FOOD_DISCOVERY_READER,
      ORDER_ANALYTICS_READER,
      ORDER_REVIEW_ELIGIBILITY_READER,
      ORDER_REVIEW_READER,
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
      findRestaurantForMessaging: () => Promise.resolve(null),
      listActiveRestaurantsForMessaging: () => Promise.resolve([]),
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
    const paymentCheckoutCommands: PaymentCheckoutCommandsPort = {
      cancelPendingCheckoutForOrder: () => Promise.resolve(),
    };
    const locationReader: LocationReaderPort = {
      findAddress: () => Promise.resolve(null),
      findOwnedAddress: () => Promise.resolve(null),
      findTemporaryAddress: () => Promise.resolve(null),
      listOwnedAddresses: () => Promise.resolve([]),
    };
    const identityReader: IdentityReaderPort = {
      findIdentityUser: () => Promise.resolve(null),
      findIdentityUsers: () => Promise.resolve([]),
    };
    const foodReviewTargetReader: FoodReviewTargetReaderPort = {
      findFoodReviewTarget: () => Promise.resolve(null),
    };
    const orderReviewEligibilityReader: OrderReviewEligibilityReaderPort = {
      findReviewEligibility: () => Promise.resolve(null),
    };
    const orderReviewReader: OrderReviewReaderPort = {
      findOrderReviewSummary: () =>
        Promise.resolve({
          foodReviews: [],
          shipperReview: null,
        }),
    };

    expect(menuReader).toBeDefined();
    expect(categoryReader).toBeDefined();
    expect(restaurantReader).toBeDefined();
    expect(promotionRedemption).toBeDefined();
    expect(paymentCheckoutCommands).toBeDefined();
    expect(locationReader).toBeDefined();
    expect(identityReader).toBeDefined();
    expect(foodReviewTargetReader).toBeDefined();
    expect(orderReviewEligibilityReader).toBeDefined();
    expect(orderReviewReader).toBeDefined();

    const contractPaths = [
      'src/features/menu/contracts/menu-reader.port.ts',
      'src/features/menu/contracts/category-reader.port.ts',
      'src/features/restaurants/contracts/restaurant-reader.port.ts',
      'src/features/locations/contracts/location-reader.port.ts',
      'src/features/locations/contracts/geocoding.port.ts',
      'src/features/promotions/contracts/promotion-redemption.port.ts',
      'src/features/payments/contracts/payment-checkout-commands.port.ts',
      'src/features/delivery/contracts/delivery-quote.port.ts',
      'src/features/users/contracts/identity-reader.port.ts',
      'src/features/menu/contracts/food-review-target-reader.port.ts',
      'src/features/menu/contracts/food-discovery-reader.port.ts',
      'src/features/orders/contracts/order-review-eligibility-reader.port.ts',
      'src/features/orders/contracts/order-analytics-reader.port.ts',
      'src/features/reviews/contracts/order-review-reader.port.ts',
    ];

    for (const contractPath of contractPaths) {
      const source = readFileSync(resolve(process.cwd(), contractPath), 'utf8');

      expect(source).not.toMatch(/typeorm|entities\//i);
    }
  });
});
